package com.wonyliu.gamearrowsandroid

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    companion object {
        private const val TAG = "GameArrowsAndroid"
        private const val JS_BRIDGE_NAME = "AndroidAdsBridge"
        private const val DEBUG_REWARDED_TEST_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"
    }

    private lateinit var webView: WebView
    private var rewardedAdInFlight = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MobileAds.initialize(this)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.loadsImagesAutomatically = true
            settings.userAgentString = "${settings.userAgentString} GameArrowsAndroid/1.0"
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            addJavascriptInterface(AndroidAdsBridge(), JS_BRIDGE_NAME)
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        setContentView(webView)
        webView.loadUrl(BuildConfig.GAME_HOME_URL)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(JS_BRIDGE_NAME)
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun requestRewardedAd(placement: String, adUnitIdFromJs: String, callbackId: String) {
        if (callbackId.isBlank()) {
            return
        }
        if (rewardedAdInFlight) {
            emitRewardedAdResult(callbackId, placement, ok = false, rewarded = false, error = "ad busy")
            return
        }

        val adUnitId = resolveRewardedAdUnitId(adUnitIdFromJs)
        if (adUnitId.isBlank()) {
            emitRewardedAdResult(callbackId, placement, ok = false, rewarded = false, error = "ad unit id empty")
            return
        }

        rewardedAdInFlight = true
        val adRequest = AdRequest.Builder().build()
        RewardedAd.load(
            this,
            adUnitId,
            adRequest,
            object : RewardedAdLoadCallback() {
                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    rewardedAdInFlight = false
                    emitRewardedAdResult(
                        callbackId = callbackId,
                        placement = placement,
                        ok = false,
                        rewarded = false,
                        error = loadAdError.message
                    )
                }

                override fun onAdLoaded(rewardedAd: RewardedAd) {
                    var rewardEarned = false
                    rewardedAd.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            rewardedAdInFlight = false
                            emitRewardedAdResult(
                                callbackId = callbackId,
                                placement = placement,
                                ok = rewardEarned,
                                rewarded = rewardEarned,
                                error = if (rewardEarned) "" else "ad interrupted"
                            )
                        }

                        override fun onAdFailedToShowFullScreenContent(adError: com.google.android.gms.ads.AdError) {
                            rewardedAdInFlight = false
                            emitRewardedAdResult(
                                callbackId = callbackId,
                                placement = placement,
                                ok = false,
                                rewarded = false,
                                error = adError.message
                            )
                        }
                    }
                    try {
                        rewardedAd.show(this@MainActivity) {
                            rewardEarned = true
                        }
                    } catch (error: Throwable) {
                        rewardedAdInFlight = false
                        emitRewardedAdResult(
                            callbackId = callbackId,
                            placement = placement,
                            ok = false,
                            rewarded = false,
                            error = error.message ?: "ad show failed"
                        )
                    }
                }
            }
        )
    }

    private fun resolveRewardedAdUnitId(rawAdUnitId: String): String {
        val trimmed = rawAdUnitId.trim()
        if (trimmed.isNotEmpty()) {
            return trimmed
        }
        if (BuildConfig.DEBUG) {
            return DEBUG_REWARDED_TEST_AD_UNIT_ID
        }
        return BuildConfig.DEFAULT_REWARDED_AD_UNIT_ID.trim()
    }

    private fun emitRewardedAdResult(
        callbackId: String,
        placement: String,
        ok: Boolean,
        rewarded: Boolean,
        error: String
    ) {
        val payload = JSONObject()
            .put("ok", ok)
            .put("rewarded", rewarded)
            .put("error", error)
            .put("placement", placement)
            .toString()
        val callbackJs = buildString {
            append("window.__androidRewardedAdResolve && window.__androidRewardedAdResolve(")
            append(JSONObject.quote(callbackId))
            append(", ")
            append(payload)
            append(");")
        }
        runOnUiThread {
            if (!::webView.isInitialized) {
                return@runOnUiThread
            }
            webView.evaluateJavascript(callbackJs, null)
        }
    }

    inner class AndroidAdsBridge {
        @JavascriptInterface
        fun playRewardedAd(placement: String?, adUnitId: String?, callbackId: String?) {
            val safePlacement = "${placement ?: ""}".trim()
            val safeAdUnitId = "${adUnitId ?: ""}".trim()
            val safeCallbackId = "${callbackId ?: ""}".trim()
            runOnUiThread {
                requestRewardedAd(safePlacement, safeAdUnitId, safeCallbackId)
            }
        }
    }
}

