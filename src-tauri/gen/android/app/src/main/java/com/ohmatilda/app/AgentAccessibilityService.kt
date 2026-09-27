package com.ohmatilda.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

// Phase 7 : service d'accessibilité de l'agent (tap/swipe/texte/arbre UI).
// Activé par l'utilisateur dans Réglages Android (DeviceAccessModal).
// Guardrails : champs password jamais lus ni remplis.
class AgentAccessibilityService : AccessibilityService() {

  companion object {
    @Volatile
    var instance: AgentAccessibilityService? = null
      private set

    fun isEnabled(): Boolean = instance != null

    const val MAX_DEPTH = 8
    const val MAX_NODES = 200
    const val MAX_TEXT_LEN = 120
  }

  override fun onServiceConnected() {
    instance = this
    Log.i("AgentAction", "service connected")
  }

  override fun onUnbind(intent: Intent?): Boolean {
    if (instance === this) instance = null
    Log.i("AgentAction", "service unbound")
    return super.onUnbind(intent)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // POC : pas d'écoute continue, lecture à la demande via getUiTree().
  }

  override fun onInterrupt() {
    Log.i("AgentAction", "interrupt")
  }

  // ---------- arbre UI ----------

  fun foregroundPackage(): String? {
    return try {
      rootInActiveWindow?.packageName?.toString()
    } catch (e: Exception) {
      Log.e("AgentAction", "foregroundPackage failed: ${e.message}")
      null
    }
  }

  fun uiTree(): String {
    return try {
      val root = rootInActiveWindow ?: return err("no active window (service enabled?)")
      val count = intArrayOf(0)
      val node = serializeNode(root, 0, count) ?: return err("empty tree")
      val out = JSONObject()
      out.put("ok", true)
      out.put("package", root.packageName?.toString() ?: "")
      out.put("tree", node)
      out.put("truncated", count[0] >= MAX_NODES)
      out.toString()
    } catch (e: Exception) {
      err("uiTree failed: ${e.message}")
    }
  }

  private fun serializeNode(n: AccessibilityNodeInfo, depth: Int, count: IntArray): JSONObject? {
    if (depth > MAX_DEPTH || count[0] >= MAX_NODES) return null
    count[0] += 1
    val o = JSONObject()
    val isPassword = n.isPassword
    if (!isPassword) {
      o.put("t", (n.text?.toString() ?: "").take(MAX_TEXT_LEN))
    }
    o.put("d", (n.contentDescription?.toString() ?: "").take(MAX_TEXT_LEN))
    o.put("cls", (n.className?.toString() ?: "").substringAfterLast('.'))
    val b = Rect()
    n.getBoundsInScreen(b)
    o.put("b", JSONArray(listOf(b.left, b.top, b.right, b.bottom)))
    o.put("c", n.isClickable)
    o.put("s", n.isScrollable)
    o.put("e", n.isEditable)
    if (isPassword) o.put("p", true)
    if (depth < MAX_DEPTH) {
      val kids = JSONArray()
      for (i in 0 until n.childCount) {
        if (count[0] >= MAX_NODES) break
        val c = n.getChild(i) ?: continue
        serializeNode(c, depth + 1, count)?.let { kids.put(it) }
        c.recycle()
      }
      if (kids.length() > 0) o.put("kids", kids)
    }
    return o
  }

  // ---------- gestures ----------

  fun tap(x: Float, y: Float, timeoutMs: Long = 4000): String {
    val path = Path().apply { moveTo(x, y) }
    val stroke = GestureDescription.StrokeDescription(path, 0, 80)
    return dispatch("tap", GestureDescription.Builder().addStroke(stroke).build(), timeoutMs)
  }

  fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long, timeoutMs: Long = 6000): String {
    val path = Path().apply {
      moveTo(x1, y1)
      lineTo(x2, y2)
    }
    val stroke = GestureDescription.StrokeDescription(path, 0, durationMs.coerceIn(50, 2000))
    return dispatch("swipe", GestureDescription.Builder().addStroke(stroke).build(), timeoutMs)
  }

  private fun dispatch(kind: String, gesture: GestureDescription, timeoutMs: Long): String {
    val done = CountDownLatch(1)
    val ok = AtomicBoolean(false)
    val errMsg = AtomicReference<String?>(null)
    val dispatched = try {
      dispatchGesture(gesture, object : GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          ok.set(true)
          done.countDown()
        }

        override fun onCancelled(gestureDescription: GestureDescription?) {
          errMsg.set("gesture cancelled")
          done.countDown()
        }
      }, null)
    } catch (e: Exception) {
      return err("$kind dispatch failed: ${e.message}")
    }
    if (!dispatched) return err("$kind not dispatched (service busy?)")
    if (!done.await(timeoutMs, TimeUnit.MILLISECONDS)) return err("$kind timeout")
    return if (ok.get()) okJson(kind) else err("$kind failed: ${errMsg.get()}")
  }

  fun press(which: String): String {
    val action = when (which) {
      "back" -> GLOBAL_ACTION_BACK
      "home" -> GLOBAL_ACTION_HOME
      "recents" -> GLOBAL_ACTION_RECENTS
      else -> return err("unknown press: $which")
    }
    return try {
      if (performGlobalAction(action)) okJson("press-$which")
      else err("press-$which failed")
    } catch (e: Exception) {
      err("press-$which failed: ${e.message}")
    }
  }

  fun inputText(text: String, maxLen: Int = 500): String {
    return try {
      val root = rootInActiveWindow ?: return err("no active window")
      val target = findEditable(root) ?: return err("no editable field on screen")
      if (target.isPassword) return err("refused: password field")
      val args = Bundle().apply {
        putCharSequence(
          AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
          text.take(maxLen)
        )
      }
      if (target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
        okJson("input")
      } else {
        err("set-text rejected by field")
      }
    } catch (e: Exception) {
      err("input failed: ${e.message}")
    }
  }

  private fun findEditable(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    // 1. champ éditable focalisé d'abord, 2. sinon premier éditable non-password.
    return findFirst(n) { it.isEditable && !it.isPassword && it.isFocused }
      ?: findFirst(n) { it.isEditable && !it.isPassword }
  }

  private fun findFirst(
    n: AccessibilityNodeInfo,
    pred: (AccessibilityNodeInfo) -> Boolean
  ): AccessibilityNodeInfo? {
    if (pred(n)) return n
    for (i in 0 until n.childCount) {
      val c = n.getChild(i) ?: continue
      val found = findFirst(c, pred)
      if (found != null) {
        if (found !== c) c.recycle()
        return found
      }
      c.recycle()
    }
    return null
  }

  private fun okJson(kind: String): String {
    val o = JSONObject()
    o.put("ok", true)
    o.put("action", kind)
    Log.i("AgentAction", "$kind ok")
    return o.toString()
  }

  private fun err(message: String): String {
    val o = JSONObject()
    o.put("ok", false)
    o.put("error", message)
    Log.e("AgentAction", message)
    return o.toString()
  }
}
