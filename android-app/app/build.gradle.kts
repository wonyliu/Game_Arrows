plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.wonyliu.gamearrowsandroid"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.wonyliu.gamearrowsandroid"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "GAME_HOME_URL", "\"\"")
        buildConfigField("String", "GAME_API_BASE_URL", "\"\"")
        buildConfigField("String", "DEFAULT_REWARDED_AD_UNIT_ID", "\"ca-app-pub-8908200288624350/9845834535\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            // Use adb reverse with localhost for stable USB debugging:
            // adb reverse tcp:4173 tcp:4173
            buildConfigField("String", "GAME_HOME_URL", "\"http://127.0.0.1:4173/index.html\"")
            buildConfigField("String", "GAME_API_BASE_URL", "\"http://127.0.0.1:4173\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "GAME_HOME_URL", "\"https://wonyliu.github.io/Game_Arrows/index.html\"")
            buildConfigField("String", "GAME_API_BASE_URL", "\"\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("com.google.android.gms:play-services-ads:24.9.0")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
