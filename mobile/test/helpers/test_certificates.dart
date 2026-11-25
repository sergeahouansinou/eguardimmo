/// Certificats auto-signés jetables (clés privées détruites) ; les empreintes
/// ont été calculées avec openssl, indépendamment du code testé :
/// `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der |
///  openssl dgst -sha256 -binary | base64`.
abstract final class TestCertificates() {
  static const rsaDerBase64 =
      'MIICsjCCAZoCCQDKnj4XkXtq7DANBgkqhkiG9w0BAQsFADAbMRkwFwYDVQQDDBBhcGkudGVzdC5pbnZhbGlkMB4XDTI2MTEyMTIwNDgyNVoXDTM2MTExODIwNDgyNVowGzEZMBcGA1UEAwwQYXBpLnRlc3QuaW52YWxpZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANlsxBSjotPvaOK3M0TUI3cVEELOgI2bziad2/kF06EnnTexmDrUnTfUfjs6k9Id7h3WjnrHTQbr+3PhhVE2g5Yz/UWxsqIA/r7VnvSqu+o/2+OkflLafs7VOAH993RguxTTYfiU+Sx+IoyW8a/DZpNMuoXs28/wP3pHvfmQlU8y9pN4O7t0EzLPN3d+PkJdeTzoHPwGEiCcZ81lG/149v5OwdvCRsN1q0C20pwbiJSbyODGGxI3gvH/UctsnMeAp1GmksJn0HfMc6rZrZ7FBBsYXpoI8EjHDzmttzdyspMdaf/0CbAPrljUT+UDXJZUouPdsRg7Xpg/CguaiXSSIJUCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEADNmWgIwa02e50Mwvo2d/MnhJHihKLGkzc9xHeYhyBEHxLx4M39sZ4lxGUf39EZK+aEmned0ss0ZaS14IHlca2E6cXvNv/EoEP9hejSyv5UHFJSnHcgLjJJZDJJ/A0G0z1l3CuFL7Y71zX1in3vAcPUkRghB/vF7+qNt4rtQJpUGOQZW/36InnrnRoI9/e8wgs9WJl+EGtyfwLoD8f41jazxYdnE0lgW982Kh3dcnVJD8moEI5OA1E9Q5WARSBSTIXp6ML1f9jLCGzqil3K2VennS0oZElqxU7abE/O7c9w2YU30jXlPsc2KCpGQHhon1L5GMKeK6WBzGRRhcs457hg==';
  static const rsaPin = 'oF0kMD9AV1tqfnswZBfnPnnft45MZ6mgnOaVdBiyVmw=';

  static const ecDerBase64 =
      'MIICGzCCAcACCQCMDgRICmQ2HTAKBggqhkjOPQQDAjAbMRkwFwYDVQQDDBBhcGkudGVzdC5pbnZhbGlkMB4XDTI2MTEyMTIwNDgyNVoXDTM2MTExODIwNDgyNVowGzEZMBcGA1UEAwwQYXBpLnRlc3QuaW52YWxpZDCCAUswggEDBgcqhkjOPQIBMIH3AgEBMCwGByqGSM49AQECIQD/////AAAAAQAAAAAAAAAAAAAAAP///////////////zBbBCD/////AAAAAQAAAAAAAAAAAAAAAP///////////////AQgWsY12Ko6k+ez671VdpiGvGUdBrDMU7D2O848PifSYEsDFQDEnTYIhucEk2pmeOETnSa3gZ9+kARBBGsX0fLhLEJH+Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT+NC4v4af5uO5+tKfA+eFivOM1drMV7Oy7ZAaDe/UfUCIQD/////AAAAAP//////////vOb6racXnoTzucrC/GMlUQIBAQNCAAR93f8+7LpLpMoYKD47WbcWuwiSrCeBkQaI4vIWtNbdQ3/kB/9k+HaxDnc0l9RizpNtL2Rk+zxbamRxv3xqlYQcMAoGCCqGSM49BAMCA0kAMEYCIQCQaiwB+U3O3BSTS3qLNuPxp1q1aZuiq/PQROgG28wLqgIhAL8lAERtunhKzLeqlTzLI0OSY9nPPKICugVZH03Zc68o';
  static const ecPin = 'XIN2OyxxDiBMgeWZUZcZ33WQcGFTlcaBcsqliCqI9RM=';
}
