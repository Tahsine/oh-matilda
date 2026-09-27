package com.ohmatilda.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

private fun insetsPayload(t: Float, r: Float, b: Float, l: Float): String =
  "(function(){var t=$t,r=$r,b=$b,l=$l;" +
    "window.__safeArea={t:t,r:r,b:b,l:l};" +
    "var de=document.documentElement;" +
    "if(de){var s=de.style;" +
    "s.setProperty('--sat',t+'px');s.setProperty('--sar',r+'px');" +
    "s.setProperty('--sab',b+'px');s.setProperty('--sal',l+'px');}})()"

class MainActivity : TauriActivity() {

  companion object {
    private const val REQ_CAPTURE = 4101
    private const val VD_WIDTH = 540
  }

  private val captureExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var capturePending = false

  // Phase 7 : bridge agent (à côté de SafeAreaBridge).
  // Screenshot : MediaProjection (fallback API < 30, ex. A520F API 26).
  // Gestures/texte/arbre : AgentAccessibilityService (activé en Réglages).
  // Guardrails natifs : allowlist d'apps ouvrables, gestures refusés dans
  // les packages sensibles, champs password jamais lus ni remplis (service).
  class AgentBridge(private val activity: MainActivity) {
    private val allowOpenApps = setOf("com.android.chrome")
    private val denyGesturePackages = setOf("com.android.settings")

    @JavascriptInterface
    fun isAgentSupported(): Boolean = true

    @JavascriptInterface
    fun isAccessibilityEnabled(): Boolean = AgentAccessibilityService.isEnabled()

    @JavascriptInterface
    fun requestScreenshot() {
      activity.mainHandler.post { activity.captureScreenshot() }
    }

    @JavascriptInterface
    fun openAccessibilitySettings(): Boolean {
      return try {
        val i = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(i)
        true
      } catch (e: Exception) {
        Log.e("AgentAction", "open settings failed: ${e.message}")
        false
      }
    }

    @JavascriptInterface
    fun openApp(packageName: String): String {
      if (!allowOpenApps.contains(packageName)) {
        return bridgeErr("openApp refused: package not allowed ($packageName)")
      }
      return try {
        val pm = activity.packageManager
        val i = pm.getLaunchIntentForPackage(packageName)
          ?: return bridgeErr("openApp: no launch intent for $packageName")
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(i)
        Log.i("AgentAction", "openApp $packageName ok")
        bridgeOk("openApp $packageName")
      } catch (e: Exception) {
        bridgeErr("openApp failed: ${e.message}")
      }
    }

    @JavascriptInterface
    fun getUiTree(): String {
      val s = requireService() ?: return bridgeErr(SERVICE_OFF)
      return s.uiTree()
    }

    @JavascriptInterface
    fun agentTap(x: Float, y: Float): String {
      val s = requireService() ?: return bridgeErr(SERVICE_OFF)
      guardForeground(s)?.let { return it }
      return s.tap(x, y)
    }

    @JavascriptInterface
    fun agentSwipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long): String {
      val s = requireService() ?: return bridgeErr(SERVICE_OFF)
      guardForeground(s)?.let { return it }
      return s.swipe(x1, y1, x2, y2, durationMs)
    }

    @JavascriptInterface
    fun agentInput(text: String): String {
      val s = requireService() ?: return bridgeErr(SERVICE_OFF)
      guardForeground(s)?.let { return it }
      return s.inputText(text)
    }

    @JavascriptInterface
    fun agentPress(which: String): String {
      val s = requireService() ?: return bridgeErr(SERVICE_OFF)
      return s.press(which)
    }

    private fun requireService(): AgentAccessibilityService? {
      val s = AgentAccessibilityService.instance
      if (s == null) Log.e("AgentAction", SERVICE_OFF)
      return s
    }

    private fun guardForeground(s: AgentAccessibilityService): String? {
      val pkg = s.foregroundPackage() ?: return null
      if (denyGesturePackages.contains(pkg)) {
        val m = "refused: agent gestures disabled in $pkg"
        Log.e("AgentAction", m)
        return bridgeErr(m)
      }
      return null
    }

    private fun bridgeOk(kind: String): String =
      "{\"ok\":true,\"action\":\"$kind\"}"

    private fun bridgeErr(message: String): String {
      Log.e("AgentAction", message)
      val safe = message.replace("\"", "'")
      return "{\"ok\":false,\"error\":\"$safe\"}"
    }

    companion object {
      private const val SERVICE_OFF =
        "accessibility service not enabled — grant it in Android Settings"
    }
  }

  private fun jsCallbackOk(payload: String) {
    val escaped = payload.replace("\\", "\\\\").replace("'", "\\'")
    runOnUiThread {
      try {
        val wv = findWebView() ?: return@runOnUiThread
        wv.evaluateJavascript("window.__onAgentScreenshot && window.__onAgentScreenshot('$escaped')", null)
      } catch (e: Exception) {
        Log.e("AgentCapture", "jsCallbackOk failed: ${e.message}")
      }
    }
  }

  private fun jsCallbackErr(message: String) {
    val escaped = message.replace("\\", "\\\\").replace("'", "\\'")
    runOnUiThread {
      try {
        val wv = findWebView() ?: return@runOnUiThread
        wv.evaluateJavascript("window.__onAgentScreenshotError && window.__onAgentScreenshotError('$escaped')", null)
      } catch (e: Exception) {
        Log.e("AgentCapture", "jsCallbackErr failed: ${e.message}")
      }
    }
  }

  private fun findWebView(): WebView? {
    // TauriActivity héberge une WebView : on la retrouve via la hiérarchie.
    val root = findViewById<android.view.ViewGroup>(android.R.id.content) ?: return null
    val queue: ArrayDeque<android.view.View> = ArrayDeque()
    queue.add(root)
    while (queue.isNotEmpty()) {
      val v = queue.removeFirst()
      if (v is WebView) return v
      if (v is android.view.ViewGroup) {
        for (i in 0 until v.childCount) queue.add(v.getChildAt(i))
      }
    }
    return null
  }

  fun captureScreenshot() {
    if (capturePending) {
      Log.i("AgentCapture", "capture already in flight, ignoring")
      return
    }
    capturePending = true
    if (projection != null && virtualDisplay != null) {
      grabFrame()
      return
    }
    try {
      ScreenCaptureService.start(this)
      val pm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      startActivityForResult(pm.createScreenCaptureIntent(), REQ_CAPTURE)
    } catch (e: Exception) {
      capturePending = false
      Log.e("AgentCapture", "consent launch failed: ${e.message}")
      jsCallbackErr("capture unavailable: ${e.message}")
    }
  }

  @Deprecated("compat API 26")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQ_CAPTURE) return
    if (resultCode != RESULT_OK || data == null) {
      capturePending = false
      Log.i("AgentCapture", "consent denied by user")
      jsCallbackErr("consent denied")
      ScreenCaptureService.stop(this)
      return
    }
    Log.i("AgentCapture", "consent ok, sdk=${android.os.Build.VERSION.SDK_INT}")
    try {
      val pm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val mp = pm.getMediaProjection(resultCode, data)
        ?: throw IllegalStateException("null projection")
      Log.i("AgentCapture", "getMediaProjection ok")
      mp.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() {
          Log.i("AgentCapture", "projection stopped by system")
        }
      }, mainHandler)
      projection = mp
    } catch (e: Exception) {
      capturePending = false
      Log.e("AgentCapture", "getMediaProjection failed: ${e.message}")
      jsCallbackErr("projection failed: ${e.message}")
      ScreenCaptureService.stop(this)
      return
    }
    try {
      // IMPORTANT : créer le VirtualDisplay VIA la MediaProjection (elle
      // transmet le token au système). DisplayManager.createVirtualDisplay
      // n'a pas le token → SecurityException CAPTURE_VIDEO_OUTPUT.
      setupVirtualDisplay(projection!!)
      // Laisse une frame arriver avant de lire.
      mainHandler.postDelayed({ grabFrame() }, 400)
    } catch (e: Exception) {
      capturePending = false
      Log.e("AgentCapture", "createVirtualDisplay failed: ${e.message}")
      jsCallbackErr("virtual display failed: ${e.message}")
      ScreenCaptureService.stop(this)
    }
  }

  private fun setupVirtualDisplay(mp: MediaProjection) {
    val metrics = resources.displayMetrics
    val scale = VD_WIDTH.toFloat() / metrics.widthPixels.toFloat()
    val w = VD_WIDTH
    val h = (metrics.heightPixels * scale).toInt()
    val reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
    imageReader = reader
    virtualDisplay = mp.createVirtualDisplay(
      "oh-matilda-agent",
      w, h, metrics.densityDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      reader.surface, null, null
    )
    Log.i("AgentCapture", "virtual display ${w}x$h ready")
  }

  private fun grabFrame() {
    captureExecutor.execute {
      try {
        val reader = imageReader
        if (reader == null || projection == null) {
          throw IllegalStateException("no active capture session")
        }
        var image = reader.acquireLatestImage()
        var tries = 0
        while (image == null && tries < 10) {
          Thread.sleep(100)
          image = reader.acquireLatestImage()
          tries += 1
        }
        if (image == null) throw IllegalStateException("no frame (timeout)")
        val planes = image.planes
        val buffer = planes[0].buffer
        val pixelStride = planes[0].pixelStride
        val rowStride = planes[0].rowStride
        val rowPadding = rowStride - pixelStride * reader.width
        val full = Bitmap.createBitmap(
          reader.width + rowPadding / pixelStride, reader.height, Bitmap.Config.ARGB_8888
        )
        full.copyPixelsFromBuffer(buffer)
        image.close()
        val cropped = Bitmap.createBitmap(full, 0, 0, reader.width, reader.height)
        if (cropped != full) full.recycle()
        val out = ByteArrayOutputStream()
        cropped.compress(Bitmap.CompressFormat.JPEG, 70, out)
        cropped.recycle()
        val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        Log.i("AgentCapture", "frame captured w=${reader.width} h=${reader.height} b64=${b64.length}")
        capturePending = false
        jsCallbackOk("data:image/jpeg;base64,$b64")
      } catch (e: Exception) {
        capturePending = false
        Log.e("AgentCapture", "grab failed: ${e.message}")
        mainHandler.post { jsCallbackErr("grab failed: ${e.message}") }
      }
    }
  }

  override fun onDestroy() {
    try {
      virtualDisplay?.release()
      projection?.stop()
      captureExecutor.shutdownNow()
    } catch (e: Exception) {
      Log.e("AgentCapture", "release failed: ${e.message}")
    }
    super.onDestroy()
  }

  class SafeAreaBridge(private val webView: WebView) {
    @JavascriptInterface
    fun requestInsets() {
      webView.post {
        val i = webView.rootWindowInsets ?: return@post
        val d = webView.resources.displayMetrics.density
        val t = i.systemWindowInsetTop / d
        val r = i.systemWindowInsetRight / d
        val b = i.systemWindowInsetBottom / d
        val l = i.systemWindowInsetLeft / d
        Log.i("SafeArea", "bridge requestInsets top=$t right=$r bottom=$b left=$l")
        webView.evaluateJavascript(insetsPayload(t, r, b, l), null)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    Log.i("SafeArea", "onWebViewCreate: webview=${webView.id}")
    val d = webView.resources.displayMetrics.density
    val push = {
      val i = webView.rootWindowInsets
      if (i != null) {
        Log.i("SafeArea", "push insets top=${i.systemWindowInsetTop / d} (density=$d)")
        webView.evaluateJavascript(
          insetsPayload(
            i.systemWindowInsetTop / d,
            i.systemWindowInsetRight / d,
            i.systemWindowInsetBottom / d,
            i.systemWindowInsetLeft / d
          ),
          null
        )
      }
    }
    webView.addJavascriptInterface(SafeAreaBridge(webView), "SafeAreaBridge")
    webView.addJavascriptInterface(AgentBridge(this), "AgentBridge")
    webView.setOnApplyWindowInsetsListener { _, insets ->
      push()
      insets
    }
    webView.postDelayed({ push() }, 500)
    webView.postDelayed({ push() }, 1500)
    webView.postDelayed({ push() }, 3000)
  }
}
