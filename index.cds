namespace soap;

// Injected implicitly into the application context compiler tree on boot
annotation binding {
    rootRequest  : String;
    rootResponse : String;
}

annotation operation : String;

annotation path : String;