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
import org.json.JSONObject

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
    private const val NOTIF_AGENT_ID = 42
    private const val CHANNEL_AGENT = "ohmatilda_agent"

    @Volatile
    var current: MainActivity? = null
      private set
  }

  private val captureExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var capturePending = false

  // Phase 1 (spec §4) : bridge agent asynchrone — UNE SEULE méthode.
  // call(reqId, method, argsJson) s'exécute sur mono-thread (sérialisé),
  // le résultat revient via window.__agentResolve(reqId, resultJson).
  // Jamais de blocage du thread JS : settle/observe prennent ~1s.
  // Guardrails natifs : voir AgentAccessibilityService (denylist openApp,
  // denylist gestures, password, status bar). Screenshot MediaProjection = POC séparé, la
  // boucle agent ne l'appelle jamais.
  class AgentBridge(private val activity: MainActivity) {
    private val agentExecutor = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun isAgentSupported(): Boolean = true

    @JavascriptInterface
    fun isAccessibilityEnabled(): Boolean = AgentAccessibilityService.isEnabled()

    @JavascriptInterface
    fun requestScreenshot() {
      activity.mainHandler.post { activity.captureScreenshot() }
    }

    @JavascriptInterface
    fun call(reqId: String, method: String, argsJson: String) {
      agentExecutor.execute {
        val result: String = try {
          AgentDispatcher.handle(method, argsJson)
        } catch (e: Exception) {
          Log.e("AgentAction", "call $method failed: ${e.message}")
          "{\"ok\":false,\"error\":\"bridge failed\"}"
        }
        // Retour pont JS→natif (best effort, jamais bloquant).
        activity.runOnUiThread {
          try {
            val wv = activity.findWebView()
            if (wv == null) {
              Log.e("AgentAction", "resolve $reqId: no webview")
              return@runOnUiThread
            }
            val expr = "window.__agentResolve ? " +
              "(window.__agentResolve(${JSONObject.quote(reqId)}, ${JSONObject.quote(result)}),'hook-ok') " +
              ": 'no-hook'"
            wv.evaluateJavascript(expr, null)
          } catch (e: Exception) {
            Log.e("AgentAction", "resolve callback failed: ${e.message}")
          }
        }
      }
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
    fun agentRunNotify(status: String, text: String) {
      activity.mainHandler.post { activity.agentNotify(status, text) }
    }

    @JavascriptInterface
    fun setStatusBarDark(dark: Boolean) {
      activity.mainHandler.post { activity.setStatusBarDark(dark) }
    }
  }

  /** Icônes status bar : claires en dark, sombres en light. */
  fun setStatusBarDark(dark: Boolean) {
    try {
      val win = window ?: return
      if (android.os.Build.VERSION.SDK_INT >= 30) {
        val ctrl = win.insetsController ?: return
        if (dark) {
          ctrl.setSystemBarsAppearance(
            0,
            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
          )
        } else {
          ctrl.setSystemBarsAppearance(
            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
          )
        }
      } else {
        @Suppress("DEPRECATION")
        val decor = win.decorView
        @Suppress("DEPRECATION")
        var flags = decor.systemUiVisibility
        flags = if (dark) {
          flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        } else {
          flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
        decor.systemUiVisibility = flags
      }
    } catch (e: Exception) {
      Log.e("AgentNotify", "statusbar style failed: ${e.message}")
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

  // ---------- notifications tâches agent ----------

  private fun agentChannel(nm: android.app.NotificationManager) {
    if (android.os.Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(
        android.app.NotificationChannel(
          CHANNEL_AGENT, "Agent tasks",
          android.app.NotificationManager.IMPORTANCE_DEFAULT
        )
      )
    }
  }

  private fun openAppIntent(): android.app.PendingIntent {
    val i = Intent(this, MainActivity::class.java)
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return android.app.PendingIntent.getActivity(
      this, 0, i,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun stopActionIntent(): android.app.PendingIntent {
    val i = Intent(AgentStopReceiver.ACTION_STOP).setPackage(packageName)
    return android.app.PendingIntent.getBroadcast(
      this, 1, i,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun agentNotify(status: String, text: String) {
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
      agentChannel(nm)
      val short = text.take(140)
      val builder = if (android.os.Build.VERSION.SDK_INT >= 26) {
        android.app.Notification.Builder(this, CHANNEL_AGENT)
      } else {
        @Suppress("DEPRECATION")
        android.app.Notification.Builder(this)
      }
      when (status) {
        "running" -> {
          builder
            .setContentTitle("Oh-Matilda agent working")
            .setContentText(short.ifEmpty { "Acting on your phone…" })
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setContentIntent(openAppIntent())
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopActionIntent())
          nm.notify(NOTIF_AGENT_ID, builder.build())
          Log.i("AgentNotify", "ongoing shown")
          startRunService()
        }
        "done", "error", "cancelled" -> {
          val title = when (status) {
            "done" -> "Agent task done"
            "cancelled" -> "Agent task stopped"
            else -> "Agent task failed"
          }
          builder
            .setContentTitle(title)
            .setContentText(short.ifEmpty { "Tap to open Oh-Matilda" })
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
          nm.notify(NOTIF_AGENT_ID, builder.build())
          Log.i("AgentNotify", "finished shown: $status")
          stopRunService()
          // Retour auto UNIQUEMENT si ça mérite l'attention (échec/stop).
          // En succès on laisse le résultat visible (démo, payoff visuel).
          if (status == "error" || status == "cancelled") bringAppFront()
        }
        else -> nm.cancel(NOTIF_AGENT_ID)
      }
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS manquante (API 33+) : log seul, l'app reste utilisable.
      Log.e("AgentNotify", "notify blocked: ${e.message}")
    } catch (e: Exception) {
      Log.e("AgentNotify", "notify failed: ${e.message}")
    }
  }

  // Phase 3 : foreground service pendant les runs (processus vivant).
  private fun startRunService() {
    try {
      val i = Intent(this, AgentRunService::class.java)
      if (android.os.Build.VERSION.SDK_INT >= 26) {
        startForegroundService(i)
      } else {
        startService(i)
      }
    } catch (e: Exception) {
      Log.e("AgentNotify", "run service start failed: ${e.message}")
    }
  }

  private fun stopRunService() {
    try {
      stopService(Intent(this, AgentRunService::class.java))
    } catch (e: Exception) {
      Log.e("AgentNotify", "run service stop failed: ${e.message}")
    }
  }

  private fun bringAppFront() {
    try {
      val i = Intent(this, MainActivity::class.java)
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(i)
      Log.i("AgentNotify", "bring to front requested")
    } catch (e: Exception) {
      // Restrictions background (API 29+) : la notification reste le chemin garanti.
      Log.e("AgentNotify", "bring to front blocked: ${e.message}")
    }
  }

  fun findWebView(): WebView? {
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
      if (current === this) current = null
      try {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.cancel(NOTIF_AGENT_ID)
      } catch (_: Exception) {}
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
    current = this
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
    // Hauteur clavier réelle (edge-to-edge : pas de resize layout, le clavier
    // est un overlay). Visible-frame vs hauteur totale = clavier, même sans
    // resize. Poussé au JS via event `kb-height` (CSS px). Seuil 100px
    // device anti-bruit (barres système). Émis uniquement sur changement.
    var lastKbCss = -1f
    val contentRoot = webView.rootView
    contentRoot.viewTreeObserver.addOnGlobalLayoutListener {
      val r = android.graphics.Rect()
      contentRoot.getWindowVisibleDisplayFrame(r)
      val fullH = contentRoot.height
      if (fullH <= 0) return@addOnGlobalLayoutListener
      val kbPx = (fullH - (r.bottom - r.top)).coerceAtLeast(0)
      val dd = webView.resources.displayMetrics.density
      val kbCss = if (kbPx > 100) kbPx / dd else 0f
      if (kbCss != lastKbCss) {
        lastKbCss = kbCss
        Log.i("KbHeight", "keyboard css px=$kbCss (kbPx=$kbPx fullH=$fullH)")
        webView.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('kb-height',{detail:$kbCss}))",
          null
        )
      }
    }
    webView.postDelayed({ push() }, 500)
    webView.postDelayed({ push() }, 1500)
    webView.postDelayed({ push() }, 3000)
  }
}
