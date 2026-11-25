/// Équipements du référentiel du backend (`Amenity`) ; un identifiant inconnu
/// reste affiché, humanisé, plutôt que masqué.
abstract final class Amenities() {
  static const _labels = {
    'wifi': 'Wi-Fi',
    'kitchen': 'Cuisine équipée',
    'washer': 'Lave-linge',
    'dishwasher': 'Lave-vaisselle',
    'air_conditioning': 'Climatisation',
    'heating': 'Chauffage',
    'parking': 'Parking',
    'elevator': 'Ascenseur',
    'balcony': 'Balcon',
    'terrace': 'Terrasse',
    'garden': 'Jardin',
    'pool': 'Piscine',
    'tv': 'Télévision',
    'workspace': 'Espace de travail',
    'pets_allowed': 'Animaux acceptés',
    'step_free_access': 'Accès sans marches',
  };

  static String label(String id) {
    final known = _labels[id];
    if (known != null) return known;
    final text = id.replaceAll('_', ' ');
    return text.isEmpty ? text : text[0].toUpperCase() + text.substring(1);
  }
}
