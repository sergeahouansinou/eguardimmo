import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  private var privacyShield: UIView?

  override func sceneWillResignActive(_ scene: UIScene) {
    #if !DEBUG
    showPrivacyShield()
    #endif
    super.sceneWillResignActive(scene)
  }

  override func sceneDidBecomeActive(_ scene: UIScene) {
    hidePrivacyShield()
    super.sceneDidBecomeActive(scene)
  }

  // Masque le contenu dans le sélecteur d'applications : l'instantané iOS
  // est pris quand la scène devient inactive.
  private func showPrivacyShield() {
    guard privacyShield == nil, let window = window else { return }
    let shield = UIView(frame: window.bounds)
    shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    shield.backgroundColor = .systemBackground
    window.addSubview(shield)
    privacyShield = shield
  }

  private func hidePrivacyShield() {
    privacyShield?.removeFromSuperview()
    privacyShield = nil
  }
}
