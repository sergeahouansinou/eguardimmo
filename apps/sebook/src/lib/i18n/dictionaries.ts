import { EXTRA_BOOKING } from "./extra.booking";
import { EXTRA_FOOTER } from "./extra.footer";
import { EXTRA_INFO } from "./extra.info";
import { EXTRA_LISTING } from "./extra.listing";
import { EXTRA_SEARCH } from "./extra.search";
import { EXTRA_SHELL } from "./extra.shell";

export type Lang = "en" | "fr";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English (US)" },
  { code: "fr", label: "Français" },
];

const BASE = {
  share: { en: "Share", fr: "Partager" },
  linkCopied: { en: "Link copied", fr: "Lien copié" },
  save: { en: "Save", fr: "Enregistrer" },
  saved: { en: "Saved", fr: "Enregistré" },
  showAllPhotos: { en: "Show all photos", fr: "Voir toutes les photos" },
  entireHome: { en: "Entire home", fr: "Logement entier" },
  guestsWord: { en: "guests", fr: "voyageurs" },
  bedroomsWord: { en: "bedrooms", fr: "chambres" },
  bedsWord: { en: "beds", fr: "lits" },
  bathsWord: { en: "baths", fr: "sdb" },
  // Ligne de faits sous le titre - UNIQUEMENT des champs réels de l'API, avec
  // pluriel correct (singulier / pluriel). Aucune valeur fabriquée.
  factRoomOne: { en: "1 room", fr: "1 pièce" },
  factRooms: { en: "{n} rooms", fr: "{n} pièces" },
  factBedroomOne: { en: "1 bedroom", fr: "1 chambre" },
  factBedrooms: { en: "{n} bedrooms", fr: "{n} chambres" },
  factBathOne: { en: "1 bathroom", fr: "1 sdb" },
  factBaths: { en: "{n} bathrooms", fr: "{n} sdb" },
  factToiletOne: { en: "1 toilet", fr: "1 WC" },
  factToilets: { en: "{n} toilets", fr: "{n} WC" },
  factArea: { en: "{n} m²", fr: "{n} m²" },
  // Capacité voyageurs RÉELLE (max_guests) - ajoutée aux faits quand renseignée.
  factGuestOne: { en: "1 guest", fr: "1 voyageur" },
  factGuests: { en: "{n} guests", fr: "{n} voyageurs" },
  // Note de capacité affichée dans le sélecteur de voyageurs (BookingCard) quand
  // la capacité réelle est renseignée par l'hôte.
  maxGuestsNote: {
    en: "This place accommodates a maximum of {n} guests",
    fr: "Ce logement accueille au maximum {n} voyageurs",
  },
  reviewsWord: { en: "reviews", fr: "avis" },
  reviewsTitle: { en: "Reviews", fr: "Avis" },
  ratingNew: { en: "New", fr: "Nouveau" },
  // ── Carte de réservation (BookingCard) ──────────────────────────────────────
  bcCheckIn: { en: "CHECK-IN", fr: "ARRIVÉE" },
  bcCheckOut: { en: "CHECKOUT", fr: "DÉPART" },
  bcGuests: { en: "GUESTS", fr: "VOYAGEURS" },
  reserveWord: { en: "Reserve", fr: "Réserver" },
  totalWord: { en: "Total", fr: "Total" },
  indicativeTotal: { en: "Indicative total", fr: "Total indicatif" },
  wontBeCharged: {
    en: "You won't be charged yet",
    fr: "Vous ne serez pas débité pour le moment",
  },
  selectDatesToSeeTotal: {
    en: "Select your dates to see the total",
    fr: "Sélectionnez vos dates pour voir le total",
  },
  rareFind: {
    en: "Rare find! This place is usually booked.",
    fr: "Perle rare ! Ce logement est souvent réservé.",
  },
  nightsWord: { en: "nights", fr: "nuits" },
  guestWordOne: { en: "guest", fr: "voyageur" },
  infantWordOne: { en: "infant", fr: "bébé" },
  infantsWord: { en: "infants", fr: "bébés" },
  petWordOne: { en: "pet", fr: "animal" },
  petsWord: { en: "pets", fr: "animaux" },
  guestAdults: { en: "Adults", fr: "Adultes" },
  guestAdultsSub: { en: "Ages 13 or above", fr: "13 ans et plus" },
  guestChildren: { en: "Children", fr: "Enfants" },
  guestChildrenSub: { en: "Ages 2 – 12", fr: "De 2 à 12 ans" },
  guestInfants: { en: "Infants", fr: "Bébés" },
  guestInfantsSub: { en: "Under 2", fr: "Moins de 2 ans" },
  guestPets: { en: "Pets", fr: "Animaux" },
  guestPetsSub: {
    en: "Travelling with an animal?",
    fr: "Vous voyagez avec un animal ?",
  },
  // ── Header (navigation + menus) ─────────────────────────────────────────────
  navHomes: { en: "Homes", fr: "Logements" },
  becomeHost: { en: "Become a host", fr: "Devenir hôte" },
  languageLabel: { en: "LANGUAGE", fr: "LANGUE" },
  languageAria: { en: "Language", fr: "Langue" },
  userMenuAria: { en: "User menu", fr: "Menu utilisateur" },
  helpCentre: { en: "Help Centre", fr: "Centre d'aide" },
  signUp: { en: "Sign up", fr: "Inscription" },
  logIn: { en: "Log in", fr: "Connexion" },
  logoutWord: { en: "Log out", fr: "Déconnexion" },
  // ── Sections accueil par type de transaction ────────────────────────────────
  noReviewsYet: {
    en: "No reviews yet",
    fr: "Pas encore d’avis",
  },
  noReviewsYetDesc: {
    en: "This home hasn’t received any reviews yet. Be the first to stay and share your experience.",
    fr: "Ce logement n’a pas encore reçu d’avis. Soyez le premier à y séjourner et à partager votre expérience.",
  },
  guestReviewer: { en: "Traveller", fr: "Voyageur" },
  mapUnavailable: {
    en: "Exact location provided after booking.",
    fr: "Localisation exacte communiquée après la réservation.",
  },
  hostedBy: { en: "Hosted by {name}", fr: "Hébergé par {name}" },
  // Phrase neutre localisée pour l'aperçu hôte (highlight) - pas de promesse fabriquée.
  hostCommitment: {
    en: "Your host is committed to a great stay.",
    fr: "Votre hôte s’engage à vous offrir un excellent séjour.",
  },
  // Titre de la fiche : "{area} à {city}" / "{area} in {city}".
  listingTitleInCity: { en: "{area} in {city}", fr: "{area} à {city}" },
  superhost: { en: "Superhost", fr: "Superhôte" },
  yearsHosting: { en: "{n} years hosting", fr: "{n} ans d’expérience" },
  showMore: { en: "Show more", fr: "Afficher plus" },
  showLess: { en: "Show less", fr: "Afficher moins" },
  whereYoullSleep: { en: "Where you’ll sleep", fr: "Où vous dormirez" },
  whatThisPlaceOffers: {
    en: "What this place offers",
    fr: "Ce que propose ce logement",
  },
  showAllAmenities: {
    en: "Show all {n} amenities",
    fr: "Voir les {n} équipements",
  },
  availability: { en: "Availability", fr: "Disponibilité" },
  nightsIn: { en: "{n} nights in {city}", fr: "{n} nuits à {city}" },
  nightIn: { en: "{n} night in {city}", fr: "{n} nuit à {city}" },
  addTravelDates: {
    en: "Add your travel dates for exact pricing",
    fr: "Ajoutez vos dates pour le prix exact",
  },
  // ── Disponibilité, séjour minimum & erreurs de réservation ──
  minStay: {
    en: "Minimum {n} nights",
    fr: "Minimum {n} nuits",
  },
  minStayOne: {
    en: "Minimum 1 night",
    fr: "Minimum 1 nuit",
  },
  unavailable: { en: "Unavailable", fr: "Indisponible" },
  selectMinStay: {
    en: "Select at least {n} nights to continue",
    fr: "Sélectionnez au moins {n} nuits pour continuer",
  },
  errMinStay: {
    en: "The minimum stay for this home is {n} nights.",
    fr: "Le séjour minimum pour ce logement est de {n} nuits.",
  },
  errNotBookableNoPrice: {
    en: "This home doesn’t have a price set yet. Booking is unavailable for now.",
    fr: "Ce logement n’a pas encore de tarif défini. Réservation impossible pour le moment.",
  },
  errDateOverlap: {
    en: "These dates are no longer available for this home. Please choose other dates.",
    fr: "Ces dates ne sont plus disponibles pour ce logement. Choisissez d’autres dates.",
  },
  errReservationGeneric: {
    en: "The booking failed. Please try again.",
    fr: "La réservation a échoué. Veuillez réessayer.",
  },
  whereYoullBe: { en: "Where you’ll be", fr: "Où vous serez" },
  neighbourhoodNote: {
    en: "{subtitle}. Quiet, safe and well-connected neighbourhood.",
    fr: "{subtitle}. Quartier calme, sûr et bien desservi.",
  },
  meetYourHost: {
    en: "Meet your host",
    fr: "Faites connaissance avec votre hôte",
  },
  overallRating: { en: "Overall rating", fr: "Note globale" },
  hostingWord: { en: "hosting", fr: "d’accueil" },
  yrs: { en: "yrs", fr: "ans" },
  // Hôte récent (agency.created_at = année courante) : pas de "0 yrs".
  newHost: { en: "New host", fr: "Nouvel hôte" },
  // Bio neutre affichée quand agency.host_bio est vide (aucune fabrication).
  hostBioNeutral: { en: "Host on eGuardImmo", fr: "Hôte sur eGuardImmo" },
  responseRate: { en: "Response rate", fr: "Taux de réponse" },
  responseTime: { en: "Response time", fr: "Délai de réponse" },
  // Buckets de délai de réponse (codes API host_response_time).
  within_an_hour: { en: "within an hour", fr: "en moins d’une heure" },
  within_a_few_hours: {
    en: "within a few hours",
    fr: "en quelques heures",
  },
  within_a_day: { en: "within a day", fr: "en moins d’une journée" },
  a_few_days: { en: "within a few days", fr: "en quelques jours" },
  languagesLabel: { en: "Languages", fr: "Langues" },
  messageHost: { en: "Message host", fr: "Contacter l’hôte" },
  paymentProtection: {
    en: "To protect your payment, always communicate through eGuardImmo.",
    fr: "Pour protéger votre paiement, échangez toujours via eGuardImmo.",
  },
  thingsToKnow: { en: "Things to know", fr: "À savoir" },
  // ── Contact hôte / vente (modal + CTA) ───────────────────────────────────────
  contactHost: { en: "Contact the host", fr: "Contacter l’hôte" },
  requestViewing: { en: "Request a viewing", fr: "Demander une visite" },
  forSale: { en: "For sale", fr: "À vendre" },
  forSaleNote: {
    en: "This property is for sale. Send a message to arrange a viewing with the agency.",
    fr: "Ce bien est à vendre. Envoyez un message pour organiser une visite avec l’agence.",
  },
  contactModalTitleRent: {
    en: "Contact the host",
    fr: "Contacter l’hôte",
  },
  contactModalTitleSale: {
    en: "Request a viewing",
    fr: "Demander une visite",
  },
  contactModalSubtitle: {
    en: "Your message goes straight to the agency managing this listing.",
    fr: "Votre message est transmis directement à l’agence qui gère cette annonce.",
  },
  contactMessageLabel: { en: "Your message", fr: "Votre message" },
  contactMessagePlaceholderRent: {
    en: "Hello, I'm interested in your place and would like more information…",
    fr: "Bonjour, votre logement m’intéresse et je souhaiterais plus d’informations…",
  },
  contactMessagePlaceholderSale: {
    en: "Hello, I'd like to arrange a viewing of this property…",
    fr: "Bonjour, je souhaiterais organiser une visite de ce bien…",
  },
  contactSend: { en: "Send message", fr: "Envoyer le message" },
  contactSending: { en: "Sending…", fr: "Envoi…" },
  contactSuccess: {
    en: "Message sent. The agency will reply to you soon.",
    fr: "Message envoyé. L’agence vous répondra prochainement.",
  },
  contactErrorEmpty: {
    en: "Please write a message before sending.",
    fr: "Veuillez écrire un message avant d’envoyer.",
  },
  contactErrorGeneric: {
    en: "Your message could not be sent. Please try again.",
    fr: "Votre message n’a pas pu être envoyé. Veuillez réessayer.",
  },
  contactClose: { en: "Close", fr: "Fermer" },
  // ── À savoir : arrivée/départ + annulation + sécurité ────────────────────────
  houseRulesTitle: { en: "House rules", fr: "Règlement intérieur" },
  checkInOutTitle: { en: "Check-in & checkout", fr: "Arrivée et départ" },
  checkInFrom: { en: "Check-in from {time}", fr: "Arrivée à partir de {time}" },
  checkOutBefore: { en: "Checkout before {time}", fr: "Départ avant {time}" },
  safetyTitle: { en: "Safety & property", fr: "Sécurité et logement" },
  safetySmokeAlarm: { en: "Smoke alarm", fr: "Détecteur de fumée" },
  safetyCoAlarm: {
    en: "Carbon monoxide alarm",
    fr: "Détecteur de monoxyde de carbone",
  },
  safetyExteriorCamera: {
    en: "Exterior security camera",
    fr: "Caméra de surveillance extérieure",
  },
  safetySelfCheckin: {
    en: "Self check-in with lockbox",
    fr: "Arrivée autonome avec boîte à clés",
  },
  cancellationTitle: {
    en: "Cancellation policy",
    fr: "Conditions d’annulation",
  },
  cancellationFlexible: { en: "Flexible", fr: "Flexible" },
  cancellationFlexibleDesc: {
    en: "Free cancellation up to 24 hours before check-in.",
    fr: "Annulation gratuite jusqu’à 24 heures avant l’arrivée.",
  },
  cancellationModerate: { en: "Moderate", fr: "Modérée" },
  cancellationModerateDesc: {
    en: "Free cancellation up to 5 days before check-in.",
    fr: "Annulation gratuite jusqu’à 5 jours avant l’arrivée.",
  },
  cancellationStrict: { en: "Strict", fr: "Stricte" },
  cancellationStrictDesc: {
    en: "Partial refund if you cancel at least 14 days before check-in.",
    fr: "Remboursement partiel en cas d’annulation au moins 14 jours avant l’arrivée.",
  },
  exploreOther: {
    en: "Explore other options in and around {city}",
    fr: "Explorez d’autres options à {city} et aux alentours",
  },
  otherStayTypes: {
    en: "Other types of stays on eGuardImmo",
    fr: "Autres types de séjours sur eGuardImmo",
  },
  allPhotos: { en: "All photos", fr: "Toutes les photos" },
  back: { en: "Back", fr: "Retour" },
  photoUnavailable: { en: "Photo unavailable", fr: "Photo indisponible" },
  characteristics: { en: "Characteristics", fr: "Caractéristiques" },
  charRef: { en: "Reference", fr: "Référence" },
  charCondition: { en: "Property condition", fr: "État du bien" },
  charSanitation: { en: "Sanitation", fr: "Assainissement" },
  charWaterSource: { en: "Water source", fr: "Source d’eau" },
  charBuildingDate: { en: "Built in", fr: "Date de construction" },
  charFirstOccupation: { en: "First occupation", fr: "Première occupation" },
  charCharges: { en: "Charges", fr: "Charges" },
  charSecurityDeposit: { en: "Security deposit", fr: "Dépôt de garantie" },
  charDepositElectricity: {
    en: "Electricity deposit",
    fr: "Caution électricité",
  },
  charDepositWater: { en: "Water deposit", fr: "Caution eau" },
  charToilets: { en: "Toilets", fr: "Toilettes" },
  charArea: { en: "Area", fr: "Superficie" },
  charPriceWithCharges: { en: "Charges included", fr: "Charges comprises" },
  valYes: { en: "Yes", fr: "Oui" },
  valNo: { en: "No", fr: "Non" },
  waterPure: { en: "Drinking water", fr: "Eau potable" },
  waterDrilling: { en: "Borehole water", fr: "Eau de forage" },
  waterWell: { en: "Well water", fr: "Eau de puits" },
  sanitationOrdinary: { en: "Ordinary", fr: "Ordinaire" },
  sanitationSemiSanitary: { en: "Semi-sanitary", fr: "Semi-sanitaire" },
  sanitationSanitary: { en: "Sanitary", fr: "Sanitaire" },
  amenityEntireAccommodation: { en: "Entire home", fr: "Logement entier" },
  amenityFurnished: { en: "Furnished", fr: "Meublé" },
  amenityPetsAllowed: { en: "Pets allowed", fr: "Animaux acceptés" },
  amenityTerrace: { en: "Terrace", fr: "Terrasse" },
  amenityAirConditioning: { en: "Air conditioning", fr: "Climatisation" },
  amenityWashingMachine: { en: "Washing machine", fr: "Machine à laver" },
  amenityWifi: { en: "Wifi", fr: "Wi-Fi" },
  amenityParking: { en: "Parking", fr: "Parking" },
  amenityFreeParking: { en: "Free parking", fr: "Parking gratuit" },
  amenityBodyguard: { en: "Security guard", fr: "Gardien" },
  amenityConcierge: { en: "Concierge", fr: "Concierge" },
  amenityHandicapedAccess: {
    en: "Wheelchair accessible",
    fr: "Accès handicapé",
  },
  amenityElectricity: { en: "Electricity", fr: "Électricité" },
  amenityDrinkingWater: { en: "Drinking water", fr: "Eau potable" },

  // ── Accueil (home) ──────────────────────────────────────────────────────
  // Hero
  heroImageAlt: {
    en: "Iconic landmarks around the world with a traveller’s suitcase",
    fr: "Monuments emblématiques du monde avec la valise d’un voyageur",
  },
  heroTitle: {
    en: "Find a place you’ll never want to leave",
    fr: "Trouvez un lieu que vous ne voudrez plus quitter",
  },
  heroSubtitle: {
    en: "Studios, apartments and houses offered by agencies and owners: book a stay or find a long-term rental.",
    fr: "Studios, appartements et maisons proposés par des agences et des propriétaires : réservez un séjour ou trouvez une location longue durée.",
  },
  // CategoryBar
  filtersLabel: { en: "Filters", fr: "Filtres" },
  // ── Panneau de filtres (page Destinations) ──
  fltGuests: { en: "Travellers", fr: "Voyageurs" },
  fltGuestsAny: { en: "Any", fr: "Indifférent" },
  fltGuestsMin: { en: "At least {n}", fr: "Au moins {n}" },
  fltMaxPrice: { en: "Maximum price", fr: "Prix maximum" },
  fltClear: { en: "Clear all", fr: "Tout effacer" },
  // Catégories RÉELLES de l'accueil (filtrent par type de transaction / durée).
  hcat_all: { en: "All", fr: "Tout" },
  hcat_short: { en: "Short stay", fr: "Courte durée" },
  hcat_long: { en: "Long term", fr: "Longue durée" },
  // Listings
  nightWord: { en: "night", fr: "nuit" },
  // Unité de période de tarification (selon paid_per normalisé), pour "{prix} / {unité}".
  unitDay: { en: "night", fr: "nuit" },
  unitWeek: { en: "week", fr: "semaine" },
  unitMonth: { en: "month", fr: "mois" },
  unitYear: { en: "year", fr: "an" },
  noListingsAvailable: {
    en: "No listings available at the moment.",
    fr: "Aucune annonce disponible pour le moment.",
  },
  continueExploring: {
    en: "Continue exploring great stays",
    fr: "Continuez à explorer de superbes logements",
  },
  removeFromFavorites: {
    en: "Remove from favourites",
    fr: "Retirer des favoris",
  },
  addToFavorites: { en: "Add to favourites", fr: "Ajouter aux favoris" },
  ctaKicker: {
    en: "For SCIs, LMNP landlords & tenants",
    fr: "Pour les SCI, LMNP & locataires",
  },
  ctaTitle: {
    en: "Manage your properties and tenants from your pocket",
    fr: "Gérez vos biens et vos locataires depuis votre poche",
  },
  ctaText: {
    en: "Whether you run an SCI, an LMNP rental or you're a tenant: track your leases, receipts and rent payments in real time - on iPhone, Android and the web.",
    fr: "SCI, LMNP, propriétaire ou locataire : suivez vos baux, vos quittances et vos loyers en temps réel - sur iPhone, Android et le web.",
  },
  ctaDownloadOn: { en: "Download on the", fr: "Télécharger sur l’" },
  ctaGetItOn: { en: "GET IT ON", fr: "DISPONIBLE SUR" },
} as const;

export const DICT = { ...BASE, ...EXTRA_SHELL, ...EXTRA_SEARCH, ...EXTRA_FOOTER, ...EXTRA_LISTING, ...EXTRA_BOOKING, ...EXTRA_INFO } as const;

export type I18nKey = keyof typeof DICT;
