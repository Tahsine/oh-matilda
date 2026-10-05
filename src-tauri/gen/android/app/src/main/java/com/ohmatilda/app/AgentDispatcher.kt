package com.ohmatilda.app

import android.os.SystemClock
import android.util.Log
import org.json.JSONObject

// Phase 1 (spec §4) : routeur fin méthode → service. Appelé depuis
// AgentBridge.call sur exécuteur mono-thread (opérations sérialisées).
// Toute erreur inclut l'écran frais quand c'est possible (construit
// côté service). Réponses = NativeResult JSON (§4.2).
object AgentDispatcher {

  /** Dernier appel JS→natif (uptime ms). Le watchdog du service détecte
   * le gel JS (plus d'appels + plus de heartbeat = renderer gelé). */
  @Volatile
  var lastBridgeAt: Long = 0L
    private set

  fun noteActivity() {
    lastBridgeAt = SystemClock.uptimeMillis()
  }

  fun handle(method: String, argsJson: String): String {
    noteActivity()
    if (method == "ping") return "{\"ok\":true,\"action\":\"ping\"}"
    val s = AgentAccessibilityService.instance
    if (s == null) {
      val o = JSONObject()
      o.put("ok", false)
      o.put("error", "accessibility service not enabled — grant it in Android Settings")
      o.put("code", "service_off")
      return o.toString()
    }
    if (method == "cancel") {
      s.requestCancel()
      val o = JSONObject()
      o.put("ok", true)
      o.put("action", "cancel")
      return o.toString()
    }
    s.clearCancel()
    return try {
      val args = if (argsJson.isBlank()) JSONObject() else JSONObject(argsJson)
      val out = when (method) {
        "observe" -> s.doObserve()
        "tap" -> s.doTap(args.getInt("id"))
        "longPress" -> s.doLongPress(args.getInt("id"))
        "type" -> s.doType(
          args.getInt("id"),
          args.optString("text", ""),
          args.optBoolean("submit", false),
          args.optBoolean("append", false)
        )
        "scroll" -> s.doScroll(args.getInt("id"), args.optString("dir", "down"))
        "swipe" -> s.doSwipe(
          args.optString("dir", "up"),
          args.optInt("dist", 500),
          if (args.has("x")) args.optDouble("x", Double.NaN).toFloat() else Float.NaN,
          if (args.has("y")) args.optDouble("y", Double.NaN).toFloat() else Float.NaN
        )
        "press" -> s.doPress(args.getString("key"))
        "openApp" -> s.doOpenApp(args.getString("name"))
        "wait" -> s.doWait(args.optLong("ms", 1000))
        "screenshot" -> s.doScreenshot()
        else -> {
          val o = JSONObject()
          o.put("ok", false)
          o.put("error", "unknown method: $method")
          o.put("code", "unsupported")
          o.toString()
        }
      }
      out
    } catch (e: Exception) {
      Log.e("AgentAction", "dispatch $method failed: ${e.message}")
      try {
        val fresh = s.observe()
        val o = JSONObject()
        o.put("ok", false)
        o.put("error", "dispatch $method failed: ${e.message}")
        o.put("screen", s.screenJson(fresh))
        o.toString()
      } catch (_: Exception) {
        "{\"ok\":false,\"error\":\"dispatch failed\"}"
      }
    }
  }
}
