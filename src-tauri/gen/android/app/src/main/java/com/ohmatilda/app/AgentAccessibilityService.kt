package com.ohmatilda.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// Phase 1 (spec §5, §6) : réécriture complète. Plus de pagination, plus de
// coords côté modèle. Chaque action : observe → agit → settle → observe.
// Le rendu texte vient de UiReader.kt ; ce service fait fenêtres + actions.
class AgentAccessibilityService : AccessibilityService() {

  companion object {
    @Volatile
    var instance: AgentAccessibilityService? = null
      private set

    fun isEnabled(): Boolean = instance != null

    // Denylist d'ouverture — UN SEUL endroit, facile à étendre : tout le
    // reste est autorisable. Play Store (installations), paiement, système.
    // Notre propre package est refusé dynamiquement (packageName, voir doOpenApp).
    val DENY_OPEN_APPS = setOf(
      "com.android.settings",
      "com.android.vending", // Play Store : installations
      "com.fedapay.myfeda", // paiement (présent sur ce device)
      "com.samsung.android.spayfw" // Samsung Pay (présent sur ce device)
    )
    val DENY_GESTURE_PACKAGES = setOf("com.android.settings")

    const val SETTLE_MIN_MS = 300L
    const val SETTLE_QUIET_MS = 250L
    const val SETTLE_SAMPLE_MS = 120L
    const val SETTLE_TIMEOUT_MS = 2500L
    const val OPENAPP_TIMEOUT_MS = 4000L
    const val SERVICE_RETRY_MS = 1500L
  }

  @Volatile
  var lastEventUptime: Long = 0L

  private val cancelFlag = AtomicBoolean(false)
  private var versionCounter = 0
  private var served: UiReader.Snapshot? = null

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
    if (event == null) return
    try {
      val pkg = event.packageName?.toString() ?: ""
      // Ticks systemui (horloge) ignorés pour le settle (§6.1).
      if (pkg == "com.android.systemui") return
      lastEventUptime = SystemClock.uptimeMillis()
    } catch (_: Exception) {}
  }

  override fun onInterrupt() {
    Log.i("AgentAction", "interrupt")
  }

  fun requestCancel() {
    cancelFlag.set(true)
  }

  fun clearCancel() {
    cancelFlag.set(false)
  }

  fun foregroundPackage(): String? {
    return try {
      rootInActiveWindow?.packageName?.toString()
    } catch (e: Exception) {
      Log.e("AgentAction", "foregroundPackage failed: ${e.message}")
      null
    }
  }

  // ---------- observation ----------

  /** Lecture fraîche + mise en cache comme snapshot servi. */
  fun observe(): UiReader.Snapshot {
    versionCounter += 1
    val snap = UiReader.read(this, versionCounter)
    served = snap
    Log.i("AgentTree", "v${snap.version} pkg=${snap.pkg} sig=${snap.sig}\n${snap.text}")
    return snap
  }

  fun screenJson(snap: UiReader.Snapshot, settled: Boolean = true): JSONObject {
    val o = JSONObject()
    o.put("v", snap.version)
    o.put("pkg", snap.pkg)
    o.put("app", snap.app)
    o.put("kbd", snap.kbd)
    o.put("settled", settled)
    o.put("sig", snap.sig)
    o.put("text", snap.text)
    val arr = JSONArray()
    for (e in snap.els) {
      val je = JSONObject()
      je.put("id", e.id)
      je.put("role", e.role)
      je.put("label", e.label)
      arr.put(je)
    }
    o.put("els", arr)
    if (snap.dialog) o.put("dialog", true)
    if (snap.truncated) o.put("truncated", true)
    return o
  }

  private fun result(
    ok: Boolean,
    screen: UiReader.Snapshot?,
    error: String? = null,
    code: String? = null,
    changed: Boolean? = null,
    atEnd: Boolean? = null,
    settled: Boolean = true,
    shot: String? = null
  ): String {
    val o = JSONObject()
    o.put("ok", ok)
    if (error != null) o.put("error", error)
    if (code != null) o.put("code", code)
    if (changed != null) o.put("changed", changed)
    if (atEnd != null) o.put("at_end", atEnd)
    if (screen != null) o.put("screen", screenJson(screen, settled))
    if (shot != null) o.put("shot", shot)
    return o.toString()
  }

  // ---------- stabilisation §6.1 ----------

  private data class Settle(val screen: UiReader.Snapshot, val settled: Boolean, val cancelled: Boolean)

  private fun settle(): Settle {
    val t0 = SystemClock.uptimeMillis()
    // Minimum 300 ms : certaines actions n'émettent aucun événement.
    while (SystemClock.uptimeMillis() - t0 < SETTLE_MIN_MS) {
      if (cancelFlag.get()) return Settle(observe(), true, true)
      SystemClock.sleep(50)
    }
    var prevSig: String? = null
    var prevSampleAt = 0L
    while (SystemClock.uptimeMillis() - t0 < SETTLE_TIMEOUT_MS) {
      if (cancelFlag.get()) return Settle(observe(), true, true)
      val quietFor = SystemClock.uptimeMillis() - lastEventUptime
      val now = SystemClock.uptimeMillis()
      if (quietFor >= SETTLE_QUIET_MS && now - prevSampleAt >= SETTLE_SAMPLE_MS) {
        val sig = UiReader.read(this, versionCounter).sig
        if (prevSig != null && prevSig == sig) {
          return Settle(observe(), true, false)
        }
        prevSig = sig
        prevSampleAt = now
      }
      SystemClock.sleep(40)
    }
    return Settle(observe(), false, false)
  }

  // ---------- résolution d'empreinte §6.2 ----------

  private data class Candidate(val node: AccessibilityNodeInfo, val dist: Float, val tier: Int, val score: Float)

  // Conseil honnête selon la cause : stale → relire ; ambiguous → préciser
  // (@top/@mid/@bot, libellé plus complet) ou scroller pour isoler.
  private fun resolveHint(err: String?): String =
    if (err == "ambiguous") "several similar elements — retry with @top/@mid/@bot, a fuller label, or scroll to isolate it"
    else "call look() to get fresh ids"

  /** Retrouve un nœud frais par empreinte. Score (meilleur d'abord) :
   * 0 = viewId identique (identité) ; 1 = même classe + libellé qui se
   * chevauche ; 2 = même classe + proche (conteneurs au libellé absorbé) ;
   * 3 = libellé seul (classe différente : suspect, dernier recours).
   * Le score prime, la distance départage. Sans ça, un conteneur avec le
   * titre de la page (tier label) battait le vrai champ (run 13:33 :
   * WebView entière résolue à la place de l'omnibox → SET_TEXT rejeté). */
  private fun resolveFresh(el: UiReader.El): Pair<AccessibilityNodeInfo?, String?> {
    val roots = ArrayList<AccessibilityNodeInfo>()
    try {
      val wins = windows
      if (!wins.isNullOrEmpty()) {
        for (w in wins) {
          try {
            val r = w.root ?: continue
            roots.add(r)
          } catch (_: Exception) {}
        }
      } else {
        try {
          rootInActiveWindow?.let { roots.add(it) }
        } catch (_: Exception) {}
      }
    } catch (_: Exception) {}
    if (roots.isEmpty()) return null to "no active window"
    val cands = ArrayList<Candidate>()
    for (r in roots) {
      collectCandidates(r, el, cands)
    }
    for (r in roots) {
      try { r.recycle() } catch (_: Exception) {}
    }
    if (cands.isEmpty()) {
      return null to "stale"
    }
    // PAS de filtre par tier : tous les candidats concourent au score.
    // (Filtrer par meilleur tier excluait le vrai nœud quand son libellé
    // avait glissé — ex. widget météo qui se met à jour — au profit de
    // faux chevauchements lointains. Run 08:47 : 23 tier-1, vrai champ
    // exclu.)
    var pool: List<Candidate> = cands
    // Suffixe @top|@mid|@bot|@left|@center|@right : si le modèle a choisi
    // une position, on filtre dessus AVANT le score (sinon les doublons
    // de label finissent en "ambiguous" alors que le choix est déjà fait).
    val wantThird = Regex(" @(top|mid|bot|left|center|right)$").find(el.label)?.groupValues?.getOrNull(1)
    if (wantThird != null) {
      val metrics = resources.displayMetrics
      val sub = pool.filter {
        val b = Rect()
        try { it.node.getBoundsInScreen(b) } catch (_: Exception) {}
        when (wantThird) {
          "left", "center", "right" ->
            UiReader.hThirdOf(b.exactCenterX(), metrics.widthPixels) == wantThird
          else ->
            UiReader.thirdOf(b.exactCenterY(), metrics.heightPixels) == wantThird
        }
      }
      if (sub.isNotEmpty()) pool = sub
    }
    // Sélection par SCORE (distance d'abord, libellé en bonus) : le minimum
    // gagne ; équivoque si un concurrent est à moins de 100 pts, SAUF
    // cible visuelle unique : tous se recouvrent (titre + conteneur de la
    // même carte, icône + barre d'outils). On prend alors le PLUS PETIT
    // (le plus précis : l'icône, pas sa barre ; le titre, pas sa carte).
    // Vrais doublons distincts (cartes adjacentes : pas d'intersection
    // commune) → ambiguous conservé.
    val best = pool.minByOrNull { it.score }!!
    if (best.score > 600) {
      recycleAll(cands, null)
      return null to "stale"
    }
    val runner = pool.filter { it !== best && kotlin.math.abs(it.score - best.score) < 100 }
    if (runner.isNotEmpty()) {
      val group = listOf(best) + runner
      val boxes = group.map {
        val r = Rect()
        try { it.node.getBoundsInScreen(r) } catch (_: Exception) {}
        it to r
      }
      // Bruit : un candidat sans bounds ne peut jamais être tapé (geste
      // impossible) — il ne doit pas bloquer une cible réelle.
      val viable = boxes.filter { !it.second.isEmpty }
      if (viable.size == 1) {
        for (c in cands) {
          if (c.node !== viable[0].first.node) {
            try { c.node.recycle() } catch (_: Exception) {}
          }
        }
        return viable[0].first.node to null
      }
      // Doublons multi-fenêtres : mêmes bounds exactes = même cible
      // (bouton rendu dans 2 fenêtres). Sinon : positions distinctes.
      val byBox = viable.groupBy({ it.second }, { it.first })
      if (byBox.size == 1) {
        val node = byBox.values.first().first().node
        for (c in cands) {
          if (c.node !== node) {
            try { c.node.recycle() } catch (_: Exception) {}
          }
        }
        return node to null
      }
      val smallestBox = viable.minByOrNull { it.second.width() * it.second.height() }
      val singleTarget = smallestBox != null && viable.all { (_, r) ->
        Rect.intersects(r, smallestBox.second)
      }
      if (!singleTarget) {
        recycleAll(cands, null)
        return null to "ambiguous"
      }
    }
    for (c in cands) {
      if (c.node !== best.node) {
        try { c.node.recycle() } catch (_: Exception) {}
      }
    }
    return best.node to null
  }

  private fun recycleAll(cands: List<Candidate>, keep: AccessibilityNodeInfo?) {
    for (c in cands) {
      if (c.node !== keep) {
        try { c.node.recycle() } catch (_: Exception) {}
      }
    }
  }

  private fun collectCandidates(n: AccessibilityNodeInfo, el: UiReader.El, out: MutableList<Candidate>) {
    try {
      if (!n.isPassword) {
        val text = n.text?.toString() ?: ""
        val desc = n.contentDescription?.toString() ?: ""
        val own = if (text.isNotEmpty()) text else desc
        val want = el.label.substringBefore(" @")
        val overlap = want.isNotEmpty() && own.isNotEmpty() &&
          (own.contains(want, ignoreCase = true) || want.contains(own, ignoreCase = true))
        val b = Rect()
        try { n.getBoundsInScreen(b) } catch (_: Exception) {}
        val dx = b.exactCenterX() - el.bounds.exactCenterX()
        val dy = b.exactCenterY() - el.bounds.exactCenterY()
        val dist = kotlin.math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
        // Classe d'action STRUCTURELLE uniquement : scrollable + clickable
        // (stables). Surtout PAS editable : c'est un flag d'ÉTAT qui dépend
        // du focus — l'exiger rend l'omnibox invisible quand il n'est pas
        // focalisé (run 13:33 : WebView résolue à la place du champ).
        var nodeClick = false
        try {
          nodeClick = n.isClickable ||
            n.actionList.any { it.id == AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK.id }
        } catch (_: Exception) {}
        val elClick = el.clickable || el.hasClickAction
        val sameClass = try {
          (el.scrollable == n.isScrollable) && (elClick == nodeClick)
        } catch (_: Exception) { false }
        val viewId = try { n.viewIdResourceName } catch (_: Exception) { null }
        // Score unifié dominé par la distance : le libellé ne sert que de
        // bonus, jamais d'override (run 08:28 : 23 tier-1 par chevauchement
        // de texte battaient le vrai champ à 0px — libellés longs absorbés).
        // viewId exact = identité (score 0). Seuils : near < 200px, équivoque < 100pts.
        // viewId exact = identité FORTE, mais pas aveugle : sans chevauchement
        // de libellé, c'est un autre élément qui recycle l'id (boutons d'une
        // même barre) → pas tier 0. Leçon 13:33 préservée : viewId + même
        // classe = identité positionnelle (libellé glissé), score = distance.
        val tier = when {
          el.viewId != null && viewId == el.viewId && overlap -> 0
          el.viewId != null && viewId == el.viewId && sameClass -> 1
          sameClass && overlap -> 1
          sameClass && !b.isEmpty && dist < 200 -> 2
          overlap -> 3
          else -> -1
        }
        if (tier >= 0) {
          val score = when (tier) {
            0 -> 0f
            // viewId + même classe, libellé glissé : identité positionnelle,
            // libellé ignoré (leçon 13:33 : omnibox défocalisée).
            1 -> if (el.viewId != null && viewId == el.viewId) dist
              else dist +
                (if (overlap) 0f else 250f) +
                (if (sameClass) 0f else 1000f)
            else -> dist +
              (if (overlap) 0f else 250f) +
              (if (sameClass) 0f else 1000f)
          }
          out.add(Candidate(n, dist, tier, score))
          // PAS de return : un ancêtre qui matche ne doit jamais masquer
          // ses descendants. La sélection par score tranche à la fin.
        }
      }
      for (i in 0 until n.childCount) {
        try {
          val c = n.getChild(i) ?: continue
          collectCandidates(c, el, out)
        } catch (_: Exception) {
          continue
        }
        // Les candidats sont gardés (recycleAll après sélection) ; le reste
        // fuit de façon bornée par la taille de l'arbre (POC, passager).
      }
    } catch (_: Exception) {}
  }

  private fun elById(id: Int): UiReader.El? = served?.els?.firstOrNull { it.id == id }

  private fun statusBarHeightPx(): Int {
    try {
      val resId = resources.getIdentifier("status_bar_height", "dimen", "android")
      if (resId > 0) return resources.getDimensionPixelSize(resId)
    } catch (_: Exception) {}
    val fallbackDp = 24f
    return (fallbackDp * resources.displayMetrics.density).toInt()
  }

  /** Point de tap sûr A1 + RAISON du refus (fix A : le modèle récupère).
   * Retourne (point, null) si OK, (null, raison guidée) sinon. */
  private data class TapPoint(val x: Float, val y: Float)

  private fun safeTapPoint(bounds: Rect, snap: UiReader.Snapshot): Pair<TapPoint?, String?> {
    val metrics = resources.displayMetrics
    if (bounds.isEmpty) return null to "empty bounds — pick another element"
    val cx = bounds.exactCenterX()
    val cy = bounds.exactCenterY()
    val sb = statusBarHeightPx()
    if (cy < sb) return null to "status-bar zone — pick an element below it"
    if (snap.kbd && !snap.kbdBounds.isEmpty &&
      snap.kbdBounds.contains(cx.toInt(), cy.toInt())) {
      return null to "covered by keyboard — press back to dismiss it, then act"
    }
    if (cx < 0 || cy < 0 || cx >= metrics.widthPixels || cy >= metrics.heightPixels) {
      return null to "outside viewport — scroll the list to reveal it"
    }
    val safe = Rect(0, sb, metrics.widthPixels, metrics.heightPixels)
    if (snap.kbd && !snap.kbdBounds.isEmpty && snap.kbdBounds.top > safe.top) {
      safe.bottom = minOf(safe.bottom, snap.kbdBounds.top)
    }
    if (!safe.intersect(bounds)) {
      return null to "no safe tap point — scroll the list or pick another element"
    }
    if (safe.isEmpty) {
      return null to "no safe tap point — scroll the list or pick another element"
    }
    return TapPoint(safe.exactCenterX(), safe.exactCenterY()) to null
  }

  private fun gestureTap(x: Float, y: Float): Boolean {
    val path = Path().apply { moveTo(x, y) }
    val stroke = GestureDescription.StrokeDescription(path, 0, 80)
    val gesture = GestureDescription.Builder().addStroke(stroke).build()
    val done = CountDownLatch(1)
    var ok = false
    try {
      val dispatched = dispatchGesture(gesture, object : GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          ok = true
          done.countDown()
        }

        override fun onCancelled(gestureDescription: GestureDescription?) {
          done.countDown()
        }
      }, null)
      if (!dispatched) return false
      done.await(4, TimeUnit.SECONDS)
    } catch (_: Exception) {
      return false
    }
    return ok
  }

  // ---------- méthodes §4.3 (toutes renvoient NativeResult + écran) ----------

  fun doObserve(): String {
    val t0 = SystemClock.uptimeMillis()
    val snap = observe()
    Log.i("AgentAction", "observe v${snap.version} sig=${snap.sig} ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, snap)
  }

  fun doTap(id: Int): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val el = elById(id) ?: return result(false, before, "unknown id $id — call look() to get fresh ids", "stale")
    if (el.password) return result(false, before, "refused: password field", "refused")
    if (DENY_GESTURE_PACKAGES.contains(before.pkg)) {
      return result(false, before, "refused: gestures disabled in ${before.pkg}", "refused")
    }
    // Jamais de gestes dans notre propre app (sidebar, Stop, messages...) :
    // l'agent doit en sortir (open_app, press back), pas taper dedans.
    if (before.pkg == packageName) {
      return result(false, before, "refused: this is the Oh-Matilda app itself — leave it first (open_app, press back)", "refused")
    }
    val (node, err) = resolveFresh(el)
    if (node == null) {
      val fresh = observe()
      Log.i("AgentAction", "tap #$id $err")
      return result(false, fresh, "tap #$id: $err — ${resolveHint(err)}", err)
    }
    var acted = false
    var how = "none"
    try {
      if (node.isPassword) {
        try { node.recycle() } catch (_: Exception) {}
        return result(false, before, "refused: password field", "refused")
      }
      // Champs de saisie : geste tactile D'ABORD (vrai événement → l'app
      // fait défiler le champ au-dessus du clavier comme au doigt).
      // ACTION_CLICK programmatique donne le focus sans toucher : le champ
      // reste caché derrière le clavier. Boutons/listes : clic direct.
      val isInput = try {
        el.role == "input" || node.isEditable ||
          (node.className?.toString() ?: "").substringAfterLast('.') == "EditText"
      } catch (_: Exception) { el.role == "input" }
      // 1. Geste au centre sûr (inputs d'abord, autres en repli).
      if (!acted && isInput) {
        val b = Rect()
        try { node.getBoundsInScreen(b) } catch (_: Exception) {}
        val (p, _) = safeTapPoint(b, before)
        if (p != null && gestureTap(p.x, p.y)) {
          acted = true
          how = "gesture-input"
        }
      }
      // 2. ACTION_CLICK direct.
      if (!acted) {
        try {
          if (node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            acted = true
            how = "click"
          }
        } catch (_: Exception) {}
      }
      // 2. Ancêtre avec ACTION_CLICK.
      if (!acted) {
        try {
          var p = node.parent
          var hops = 0
          while (p != null && hops < 6 && !acted) {
            try {
              if (p.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                acted = true
                how = "ancestor-click"
              }
            } catch (_: Exception) {}
            val next = try { p.parent } catch (_: Exception) { null }
            try { p.recycle() } catch (_: Exception) {}
            p = next
            hops += 1
          }
        } catch (_: Exception) {}
      }
      // 3. Geste au centre sûr (A1 : aussi pour les lignes "text").
      // (Inputs : déjà tenté en 1 ; ici repli pour les autres.)
      if (!acted) {
        val b = Rect()
        try { node.getBoundsInScreen(b) } catch (_: Exception) {}
        val (p, reason) = safeTapPoint(b, before)
        if (p == null) {
          try { node.recycle() } catch (_: Exception) {}
          val fresh = observe()
          return result(false, fresh, "refused: $reason", "refused")
        }
        acted = gestureTap(p.x, p.y)
        how = "gesture"
      }
      try { node.recycle() } catch (_: Exception) {}
    } catch (e: Exception) {
      try { node.recycle() } catch (_: Exception) {}
      val fresh = observe()
      return result(false, fresh, "tap failed: ${e.message}")
    }
    if (!acted) {
      val fresh = observe()
      Log.i("AgentAction", "tap #$id rejected by element")
      return result(false, fresh, "tap #$id rejected by element")
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i(
      "AgentAction",
      "tap #$id \"$how\" ok changed=$changed settled=${st.settled} ${(SystemClock.uptimeMillis() - t0)}ms"
    )
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doLongPress(id: Int): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val el = elById(id) ?: return result(false, before, "unknown id $id — call look() to get fresh ids", "stale")
    if (el.password) return result(false, before, "refused: password field", "refused")
    if (DENY_GESTURE_PACKAGES.contains(before.pkg)) {
      return result(false, before, "refused: gestures disabled in ${before.pkg}", "refused")
    }
    // Jamais de gestes dans notre propre app (sidebar, Stop, messages...) :
    // l'agent doit en sortir (open_app, press back), pas taper dedans.
    if (before.pkg == packageName) {
      return result(false, before, "refused: this is the Oh-Matilda app itself — leave it first (open_app, press back)", "refused")
    }
    val (node, err) = resolveFresh(el)
    if (node == null) {
      val fresh = observe()
      return result(false, fresh, "longPress #$id: $err — ${resolveHint(err)}", err)
    }
    var acted = false
    try {
      try {
        if (node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) acted = true
      } catch (_: Exception) {}
      if (!acted) {
        val b = Rect()
        try { node.getBoundsInScreen(b) } catch (_: Exception) {}
        val (p, reason) = safeTapPoint(b, before)
        if (p == null) {
          try { node.recycle() } catch (_: Exception) {}
          val fresh = observe()
          return result(false, fresh, "refused: $reason", "refused")
        }
        val path = Path().apply { moveTo(p.x, p.y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 500)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        val done = CountDownLatch(1)
        try {
          val d = dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
              acted = true
              done.countDown()
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
              done.countDown()
            }
          }, null)
          if (d) done.await(4, TimeUnit.SECONDS)
          } catch (_: Exception) {}
      }
      try { node.recycle() } catch (_: Exception) {}
    } catch (e: Exception) {
      try { node.recycle() } catch (_: Exception) {}
      val fresh = observe()
      return result(false, fresh, "longPress failed: ${e.message}")
    }
    if (!acted) {
      val fresh = observe()
      return result(false, fresh, "longPress #$id rejected")
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "longPress #$id ok changed=$changed ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doType(id: Int, text: String, submit: Boolean, append: Boolean): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val el = elById(id) ?: return result(false, before, "unknown id $id — call look() to get fresh ids", "stale")
    if (el.password) return result(false, before, "refused: password field", "refused")
    if (DENY_GESTURE_PACKAGES.contains(before.pkg)) {
      return result(false, before, "refused: gestures disabled in ${before.pkg}", "refused")
    }
    // Jamais de gestes dans notre propre app (sidebar, Stop, messages...) :
    // l'agent doit en sortir (open_app, press back), pas taper dedans.
    if (before.pkg == packageName) {
      return result(false, before, "refused: this is the Oh-Matilda app itself — leave it first (open_app, press back)", "refused")
    }
    val resolved = resolveFresh(el)
    if (resolved.first == null) {
      val fresh = observe()
      return result(false, fresh, "type #$id: ${resolved.second} — ${resolveHint(resolved.second)}", resolved.second)
    }
    var node: AccessibilityNodeInfo = resolved.first!!
    fun nodeInfo(n: AccessibilityNodeInfo): String {
      return try {
        val b = Rect()
        try { n.getBoundsInScreen(b) } catch (_: Exception) {}
        "cls=${(n.className?.toString() ?: "").substringAfterLast('.')} e=${n.isEditable} f=${n.isFocused} b=${b.exactCenterX()},${b.exactCenterY()}"
      } catch (_: Exception) { "?" }
    }
    // Attend l'ouverture du clavier (fenêtre IME) après un tap de focus.
    fun waitKeyboard(timeoutMs: Long): Boolean {
      val deadline = SystemClock.uptimeMillis() + timeoutMs
      while (SystemClock.uptimeMillis() < deadline) {
        if (cancelFlag.get()) return false
        try {
          val wins = windows
          if (wins != null) {
            for (w in wins) {
              if (w.type != AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue
              val b = Rect()
              try { w.getBoundsInScreen(b) } catch (_: Exception) { continue }
              if (!b.isEmpty) return true
            }
          }
        } catch (_: Exception) {}
        SystemClock.sleep(200)
      }
      return false
    }
    // Re-résout après un tap de focus : le tap reconstruit l'arbre
    // (suggestions) et périme le nœud tenu en main (run 13:03 : SET_TEXT
    // rejeté sur handle mort).
    fun refocus(): Boolean {
      try { node.recycle() } catch (_: Exception) {}
      val r2 = resolveFresh(el)
      if (r2.first == null) return false
      node = r2.first!!
      Log.i("AgentAction", "type #$id focus tapped, re-resolved")
      return true
    }
    try {
      if (node.isPassword) {
        try { node.recycle() } catch (_: Exception) {}
        return result(false, before, "refused: password field", "refused")
      }
      // NOTE : pas de vérification isEditable ici — c'est un flag d'état
      // (faux négatifs prouvés run 13:33). Le SET_TEXT dira lui-même s'il
      // passe ; en cas d'échec, erreur lisible ci-dessous.
      if (!node.isEditable) {
        // Champ non éditable apparent : focus/click d'abord (ex. faux input).
        Log.i("AgentAction", "type #$id pre ${nodeInfo(node)}")
        try { node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) } catch (_: Exception) {}
        try { node.performAction(AccessibilityNodeInfo.ACTION_CLICK) } catch (_: Exception) {}
        SystemClock.sleep(300)
        if (!refocus()) {
          val fresh = observe()
          return result(false, fresh, "type #$id: stale after focus — call look() to get fresh ids", "stale")
        }
        if (!waitKeyboard(2000)) {
          try { node.recycle() } catch (_: Exception) {}
          val fresh = observe()
          Log.i("AgentAction", "type #$id keyboard did not open")
          return result(false, fresh, "type #$id: keyboard did not open — tap the field again or press back first", "not_found")
        }
      } else {
        // Champ éditable : donner le focus (tap) si pas déjà focalisé, pour
        // que le clavier s'ouvre — sinon submit ne trouve aucune touche
        // (run 09:39 : clavier fermé → not_found en boucle).
        val focused = try { node.isFocused } catch (_: Exception) { true }
        if (!focused) {
          Log.i("AgentAction", "type #$id pre ${nodeInfo(node)}")
          try { node.performAction(AccessibilityNodeInfo.ACTION_FOCUS) } catch (_: Exception) {}
          try { node.performAction(AccessibilityNodeInfo.ACTION_CLICK) } catch (_: Exception) {}
          SystemClock.sleep(500)
          if (!refocus()) {
            val fresh = observe()
            return result(false, fresh, "type #$id: stale after focus — call look() to get fresh ids", "stale")
          }
          if (!waitKeyboard(2000)) {
            try { node.recycle() } catch (_: Exception) {}
            val fresh = observe()
            Log.i("AgentAction", "type #$id post ${nodeInfo(node)} kbd=false")
            return result(false, fresh, "type #$id: keyboard did not open — tap the field again or press back first", "not_found")
          }
          Log.i("AgentAction", "type #$id post ${nodeInfo(node)} kbd=true")
        }
      }
      Log.i("AgentAction", "type #$id set ${nodeInfo(node)}")
      val value = text.take(500)
      val args = Bundle().apply {
        putCharSequence(
          AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
          if (append) {
            val cur = try { node.text?.toString() ?: "" } catch (_: Exception) { "" }
            (cur + value).take(500)
          } else {
            value
          }
        )
      }
      val setOk = try {
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
      } catch (_: Exception) { false }
      try { node.recycle() } catch (_: Exception) {}
      if (!setOk) {
        val fresh = observe()
        Log.i("AgentAction", "type #$id set-text rejected")
        return result(false, fresh, "type #$id rejected by field")
      }
    } catch (e: Exception) {
      val fresh = observe()
      return result(false, fresh, "type failed: ${e.message}")
    }
    if (submit) {
      val sub = submitEnter()
      if (!sub) {
        val fresh = observe()
        Log.i("AgentAction", "type #$id typed but submit did not navigate")
        return result(false, fresh, "typed but submit did not navigate (keyboard still open)", "not_found")
      }
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "type #$id submit=$submit ok changed=$changed ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  // Touche Entrée/Search/Go : API ≥ 30 → ACTION_IME_ENTER, sinon balayage
  // de la fenêtre clavier UNIQUEMENT, matching contains insensible à la
  // casse, libellés FR/EN étendus (spike S4 : "Aller à").
  private val enterTokens = listOf(
    "search", "go", "enter", "done", "send", "next", "ok", "submit",
    "recherche", "rechercher", "aller", "suivant", "terminé", "termine",
    "envoyer", "valider", "fini", "entrée", "entree", "➔", "→", "⏎"
  )

  /** Clavier ouvert ? (fenêtre IME aux bounds non vides). */
  private fun isKeyboardOpen(): Boolean {
    try {
      val wins = windows ?: return false
      for (w in wins) {
        if (w.type != AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue
        val b = Rect()
        try { w.getBoundsInScreen(b) } catch (_: Exception) { continue }
        if (!b.isEmpty) return true
      }
    } catch (_: Exception) {}
    return false
  }

  private fun submitEnter(): Boolean {
    if (Build.VERSION.SDK_INT >= 30) {
      try {
        val root = rootInActiveWindow
        if (root != null) {
          val target = findEditableFresh(root)
          if (target != null) {
            val ok = try {
              target.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)
            } catch (_: Exception) { false }
            try { target.recycle() } catch (_: Exception) {}
            try { root.recycle() } catch (_: Exception) {}
            if (ok) return true
          } else {
            try { root.recycle() } catch (_: Exception) {}
          }
        }
      } catch (_: Exception) {}
    }
    // Ordre prouvé en gates : 1) positionnel (bas-droite du clavier mesuré —
    // "Aller à" sur le clavier testé, portrait), vérifié par fermeture du
    // clavier ; 2) scan par libellé en repli. Le scan seul matchait des faux
    // positifs (barre de suggestions) sans naviguer (run 22:02).
    try {
      val wins = try { windows } catch (_: Exception) { return false }
      if (wins.isNullOrEmpty()) {
        return false
      }
      // 1) Positionnel d'abord : géométrie prouvée 3/3 (bas-droite du clavier
      // mesuré = "Aller à"). On fait confiance au dispatch : la boucle voit
      // le nouvel écran de toute façon (faux positif = un tour perdu, alors
      // qu'un faux négatif = stuck). La vérification clavier ne vaut que
      // pour le chemin scan, non prouvé.
      for (w in wins) {
        if (w.type != AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue
        val kb = Rect()
        try { w.getBoundsInScreen(kb) } catch (_: Exception) { continue }
        if (kb.isEmpty) continue
        val x = kb.right - kb.width() * 0.07f
        val y = kb.bottom - kb.height() * 0.06f
        Log.i("AgentAction", "enter positional tap $x,$y in $kb")
        if (gestureTap(x, y)) return true
      }
      // 2) Scan par libellé en repli.
      for (w in wins) {
        if (w.type != AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue
        val root = try { w.root } catch (_: Exception) { null }
        if (root == null) {
          continue
        }
        val key = findEnterKey(root)
        try { root.recycle() } catch (_: Exception) {}
        if (key == null) continue
        val b = Rect()
        key.getBoundsInScreen(b)
        try { key.recycle() } catch (_: Exception) {}
        if (b.isEmpty) continue
        if (gestureTap(b.exactCenterX(), b.exactCenterY())) {
          SystemClock.sleep(800)
          if (!isKeyboardOpen()) {
            return true
          }
        }
      }
      Log.i("AgentAction", "enter: no navigation (keyboard still open)")
    } catch (_: Exception) {}
    return false
  }

  private fun findEnterKey(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    val label = ((try { n.text?.toString() ?: "" } catch (_: Exception) { "" }) + " " +
      (try { n.contentDescription?.toString() ?: "" } catch (_: Exception) { "" })).trim().lowercase()
    val clickable = try { n.isClickable } catch (_: Exception) { false }
    if (clickable && label.isNotEmpty() && enterTokens.any { label.contains(it) }) return n
    try {
      for (i in 0 until n.childCount) {
        val c = n.getChild(i) ?: continue
        val found = findEnterKey(c)
        if (found != null) {
          if (found !== c) c.recycle()
          return found
        }
        c.recycle()
      }
    } catch (_: Exception) {}
    return null
  }

  private fun findEditableFresh(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    fun pred(x: AccessibilityNodeInfo): Boolean {
      return try { x.isEditable && !x.isPassword } catch (_: Exception) { false }
    }
    fun walk(x: AccessibilityNodeInfo): AccessibilityNodeInfo? {
      if (pred(x)) return x
      try {
        for (i in 0 until x.childCount) {
          val c = x.getChild(i) ?: continue
          val f = walk(c)
          if (f != null) {
            if (f !== c) c.recycle()
            return f
          }
          c.recycle()
        }
      } catch (_: Exception) {}
      return null
    }
    return walk(n)
  }

  fun doScroll(id: Int, dir: String): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val el = elById(id) ?: return result(false, before, "unknown id $id — call look() to get fresh ids", "stale")
    if (DENY_GESTURE_PACKAGES.contains(before.pkg)) {
      return result(false, before, "refused: gestures disabled in ${before.pkg}", "refused")
    }
    // Jamais de gestes dans notre propre app (sidebar, Stop, messages...) :
    // l'agent doit en sortir (open_app, press back), pas taper dedans.
    if (before.pkg == packageName) {
      return result(false, before, "refused: this is the Oh-Matilda app itself — leave it first (open_app, press back)", "refused")
    }
    val (node, err) = resolveFresh(el)
    if (node == null) {
      val fresh = observe()
      return result(false, fresh, "scroll #$id: $err — ${resolveHint(err)}", err)
    }
    var acted = false
    try {
      val scrollable = try { node.isScrollable } catch (_: Exception) { false }
      if (!scrollable) {
        try { node.recycle() } catch (_: Exception) {}
        return result(false, before, "refused: id $id not scrollable", "refused")
      }
      val action = when (dir.lowercase()) {
        "up" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD.id
        "left" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_LEFT.id
        "right" -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id
        else -> AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD.id
      }
      acted = try { node.performAction(action) } catch (_: Exception) { false }
      try { node.recycle() } catch (_: Exception) {}
    } catch (e: Exception) {
      val fresh = observe()
      return result(false, fresh, "scroll failed: ${e.message}")
    }
    if (!acted) {
      val fresh = observe()
      return result(false, fresh, "scroll #$id rejected (end?)", "not_found")
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    val atEnd = !changed
    Log.i("AgentAction", "scroll #$id $dir ok changed=$changed at_end=$atEnd ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, atEnd = atEnd, settled = st.settled)
  }

  // Geste humain libre (pas de conteneur requis) : swipe depuis un point
  // d'ancrage (défaut : centre du viewport sous la status bar) dans une
  // direction, sur une distance en px (défaut 500, clampée au viewport).
  fun doSwipe(dir: String, distPx: Int, x: Float, y: Float): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    if (DENY_GESTURE_PACKAGES.contains(before.pkg)) {
      return result(false, before, "refused: gestures disabled in ${before.pkg}", "refused")
    }
    // Jamais de gestes dans notre propre app (sidebar, Stop, messages...) :
    // l'agent doit en sortir (open_app, press back), pas taper dedans.
    if (before.pkg == packageName) {
      return result(false, before, "refused: this is the Oh-Matilda app itself — leave it first (open_app, press back)", "refused")
    }
    val metrics = resources.displayMetrics
    val sb = statusBarHeightPx()
    val w = metrics.widthPixels.toFloat()
    val h = metrics.heightPixels.toFloat()
    var ax = if (x.isNaN()) w / 2f else x
    var ay = if (y.isNaN()) h / 2f else y
    ax = ax.coerceIn(0f, w - 1f)
    ay = ay.coerceIn(sb.toFloat() + 1f, h - 1f)
    val d = distPx.coerceIn(100, 1500).toFloat()
    var bx = ax
    var by = ay
    when (dir.lowercase()) {
      "up" -> by = (ay - d).coerceAtLeast(sb.toFloat() + 1f)
      "down" -> by = (ay + d).coerceAtMost(h - 1f)
      "left" -> bx = (ax - d).coerceAtLeast(0f)
      "right" -> bx = (ax + d).coerceAtMost(w - 1f)
      else -> return result(false, before, "unknown swipe dir: $dir", "unsupported")
    }
    if (kotlin.math.abs(bx - ax) < 50 && kotlin.math.abs(by - ay) < 50) {
      return result(false, before, "swipe too short after clamping", "unsupported")
    }
    val path = Path().apply {
      moveTo(ax, ay)
      lineTo(bx, by)
    }
    val stroke = GestureDescription.StrokeDescription(path, 0, 300)
    val gesture = GestureDescription.Builder().addStroke(stroke).build()
    val done = CountDownLatch(1)
    var ok = false
    try {
      val dispatched = dispatchGesture(gesture, object : GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          ok = true
          done.countDown()
        }

        override fun onCancelled(gestureDescription: GestureDescription?) {
          done.countDown()
        }
      }, null)
      if (!dispatched) return result(false, before, "swipe dispatch failed")
      done.await(4, TimeUnit.SECONDS)
    } catch (e: Exception) {
      return result(false, before, "swipe failed: ${e.message}")
    }
    if (!ok) {
      val fresh = observe()
      return result(false, fresh, "swipe rejected")
    }
    if (cancelFlag.get()) {
      val fresh = observe()
      return result(false, fresh, "cancelled", "timeout")
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "swipe $dir ok changed=$changed ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doPress(key: String): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val action = when (key) {
      "back" -> GLOBAL_ACTION_BACK
      "home" -> GLOBAL_ACTION_HOME
      "recents" -> GLOBAL_ACTION_RECENTS
      else -> null
    }
    if (action == null) return result(false, before, "unknown press: $key", "unsupported")
    val ok = try { performGlobalAction(action) } catch (_: Exception) { false }
    if (!ok) {
      val fresh = observe()
      return result(false, fresh, "press-$key failed")
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "press-$key ok changed=$changed ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doOpenApp(name: String): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val want = name.trim().lowercase()
    // 1) Résolution parmi les apps lançables (requiert <queries> LAUNCHER,
    // manifest — sinon seules nos apps sont visibles sur Android 11+).
    // Ordre : égalité exacte du label, puis préfixe, puis contains.
    data class Hit(val pkg: String, val label: String, val rank: Int)
    val hits = ArrayList<Hit>()
    try {
      val pm = packageManager
      val mains = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val acts = pm.queryIntentActivities(mains, 0)
      for (ri in acts) {
        val pkg = ri.activityInfo?.packageName ?: continue
        if (pkg == packageName) continue // jamais nous-mêmes
        if (DENY_OPEN_APPS.contains(pkg)) continue
        val label = try {
          ri.loadLabel(pm)?.toString() ?: ""
        } catch (_: Exception) { "" }
        if (label.isEmpty()) continue
        // Correspondance sur le label OU le package (ex. "Chrome").
        for (cand in listOf(label.lowercase(), pkg.lowercase())) {
          val rank = when {
            cand == want -> 0
            cand.startsWith(want) || want.startsWith(cand) -> 1
            cand.contains(want) || want.contains(cand) -> 2
            else -> -1
          }
          if (rank >= 0) {
            hits.add(Hit(pkg, label, rank))
            break
          }
        }
      }
    } catch (_: Exception) {}
    if (hits.isEmpty()) {
      return result(false, before, "refused: app not allowed ($name)", "refused")
    }
    val best = hits.minByOrNull { it.rank }!!
    val rivals = hits.filter { it.pkg != best.pkg && it.rank == best.rank }
      .map { it.label }.distinct()
    if (rivals.isNotEmpty()) {
      val names = (listOf(best.label) + rivals).distinct().joinToString(", ")
      return result(false, before, "ambiguous: several apps match ($names) — be more specific", "ambiguous")
    }
    val targetPkg = best.pkg
    try {
      val i = packageManager.getLaunchIntentForPackage(targetPkg)
        ?: return result(false, before, "openApp: no launch intent for $targetPkg")
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      startActivity(i)
    } catch (e: Exception) {
      return result(false, before, "openApp failed: ${e.message}")
    }
    // Attendre le package au premier plan (4 s) puis settle.
    val deadline = SystemClock.uptimeMillis() + OPENAPP_TIMEOUT_MS
    while (SystemClock.uptimeMillis() < deadline) {
      if (cancelFlag.get()) break
      if (foregroundPackage() == targetPkg) break
      SystemClock.sleep(150)
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "openApp $targetPkg ok fg=${st.screen.pkg} ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doWait(ms: Long): String {
    val t0 = SystemClock.uptimeMillis()
    val before = observe()
    val capped = ms.coerceIn(100, 5000)
    val deadline = SystemClock.uptimeMillis() + capped
    while (SystemClock.uptimeMillis() < deadline) {
      if (cancelFlag.get()) {
        val s = observe()
        return result(false, s, "cancelled", "timeout")
      }
      SystemClock.sleep(100)
    }
    val st = settle()
    val changed = st.screen.sig != before.sig
    Log.i("AgentAction", "wait ${capped}ms ok changed=$changed ${(SystemClock.uptimeMillis() - t0)}ms")
    return result(true, st.screen, changed = changed, settled = st.settled)
  }

  fun doScreenshot(): String {
    val before = observe()
    if (Build.VERSION.SDK_INT < 30) {
      return result(false, before, "screenshot unsupported on API < 30", "unsupported")
    }
    try {
      val done = CountDownLatch(1)
      var dataUrl: String? = null
      val cb = object : AccessibilityService.TakeScreenshotCallback {
        override fun onFailure(errorCode: Int) {
          done.countDown()
        }

        override fun onSuccess(screenshot: AccessibilityService.ScreenshotResult) {
          try {
            val hw = screenshot.hardwareBuffer
            if (hw != null) {
              val bmp = android.graphics.Bitmap.wrapHardwareBuffer(hw, screenshot.colorSpace)
              if (bmp != null) {
                val w = 540
                val h = (540f * bmp.height / bmp.width).toInt().coerceAtLeast(1)
                val small = android.graphics.Bitmap.createScaledBitmap(bmp, w, h, true)
                val out = ByteArrayOutputStream()
                small.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, out)
                val b64 = android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
                dataUrl = "data:image/jpeg;base64,$b64"
                small.recycle()
                if (small != bmp) bmp.recycle()
              }
              hw.close()
            }
          } catch (_: Exception) {}
          done.countDown()
        }
      }
      takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, cb)
      done.await(6, TimeUnit.SECONDS)
      if (dataUrl != null) {
        return result(true, before, shot = dataUrl)
      }
      return result(false, before, "screenshot failed")
    } catch (e: Exception) {
      return result(false, before, "screenshot failed: ${e.message}")
    }
  }
}
