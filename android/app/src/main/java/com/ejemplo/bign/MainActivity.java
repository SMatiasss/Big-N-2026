package com.ejemplo.bign;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mantiene el audio de la aplicación habilitado sin exigir un toque previo.
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
