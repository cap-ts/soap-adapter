namespace soap;

annotation binding {
    rootRequest  : String;
    rootResponse : String;
}
annotation operation : String;
annotation rootResponse : String;
annotation path : String;
annotation filterRestriction {
    mandatoryFields : array of String;
    multipleSelection : Boolean;
};