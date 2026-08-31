package com.ejemplo.pruebas;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Le decimos a Android que permita el Autoplay sin tocar la pantalla
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
