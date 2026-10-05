package com.ohmatilda.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

// Bouton Stop de la notification "tâche en cours" → transmet au JS
// (`window.__onAgentStop`, câblé sur cancelAgentTask côté store).
class AgentStopReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_STOP = "com.ohmatilda.app.action.AGENT_STOP"
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_STOP) return
    Log.i("AgentNotify", "stop requested from notification")
    val activity = MainActivity.current
    if (activity == null) {
      Log.e("AgentNotify", "no current activity for stop")
      return
    }
    activity.runOnUiThread {
      try {
        activity.findWebView()?.evaluateJavascript(
          "window.__onAgentStop && window.__onAgentStop()", null
        )
      } catch (e: Exception) {
        Log.e("AgentNotify", "stop callback failed: ${e.message}")
      }
    }
  }
}
