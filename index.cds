namespace soap;

// Injected implicitly into the application context compiler tree on boot
annotation binding {
    operation    : String;
    rootRequest  : String;
    rootResponse : String;
}

annotation path : String;