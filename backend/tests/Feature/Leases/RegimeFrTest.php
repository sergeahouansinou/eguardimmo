<?php

declare(strict_types=1);

use App\Modules\Leases\Data\RegimeData;
use App\Modules\Leases\Data\RegimeTermsData;
use App\Modules\Leases\Jurisdictions\JurisdictionDataValidator;
use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

function regimeFr(string $cle): LeaseRegime
{
    return app(LeaseRegimes::class)->for('FR', $cle);
}

/**
 * @param  array<string, mixed>  $donnees
 */
function regimeTermes(string $cle, array $donnees = []): RegimeTermsData
{
    return RegimeTermsData::from(regimeFr($cle), $donnees);
}

it('fixe les durées et la reconduction du bail vide', function (array $donnees, int $duree, int $reconduction): void {
    $termes = regimeTermes('fr.residential.unfurnished', $donnees);

    expect($termes->defaultDurationMonths)->toBe($duree)
        ->and($termes->minimumDurationMonths)->toBe($duree)
        ->and($termes->maximumDurationMonths)->toBeNull()
        ->and($termes->tacitRenewal)->toBeTrue()
        ->and($termes->renewalMonths)->toBe($reconduction);
})->with([
    'bailleur personne physique' => [[], 36, 36],
    'personne physique explicite' => [['landlord_is_legal_entity' => false], 36, 36],
    'personne morale' => [['landlord_is_legal_entity' => true], 72, 72],
]);

it('fixe les durées et la reconduction du bail meublé', function (array $donnees, int $duree, bool $tacite, ?int $reconduction): void {
    $termes = regimeTermes('fr.residential.furnished', $donnees);

    expect($termes->defaultDurationMonths)->toBe($duree)
        ->and($termes->minimumDurationMonths)->toBe($duree)
        ->and($termes->tacitRenewal)->toBe($tacite)
        ->and($termes->renewalMonths)->toBe($reconduction);
})->with([
    'meublé classique' => [[], 12, true, 12],
    'étudiant, 9 mois sans reconduction tacite' => [['student' => true], 9, false, null],
]);

it('encadre le bail mobilité de 1 à 10 mois, sans reconduction', function (): void {
    $termes = regimeTermes('fr.residential.mobility');

    expect($termes->minimumDurationMonths)->toBe(1)
        ->and($termes->maximumDurationMonths)->toBe(10)
        ->and($termes->defaultDurationMonths)->toBe(10)
        ->and($termes->tacitRenewal)->toBeFalse()
        ->and($termes->renewalMonths)->toBeNull();
});

it('ne fixe aucune durée ni préavis légal au droit commun', function (): void {
    $termes = regimeTermes('fr.common_law');

    expect($termes->maximumDurationMonths)->toBeNull()
        ->and($termes->tacitRenewal)->toBeFalse()
        ->and($termes->depositCapMonths)->toBeNull()
        ->and($termes->tenantNoticeMonths)->toBeNull()
        ->and($termes->landlordNoticeMonths)->toBeNull();
});

it('plafonne le dépôt de garantie en mois de loyer hors charges', function (string $cle, array $donnees, ?int $plafond): void {
    expect(regimeTermes($cle, $donnees)->depositCapMonths)->toBe($plafond);
})->with([
    'vide : 1 mois' => ['fr.residential.unfurnished', [], 1],
    'vide, loyer payé d\'avance pour plus de 2 mois : aucun dépôt' => ['fr.residential.unfurnished', ['advance_rent_over_two_months' => true], 0],
    'meublé : 2 mois' => ['fr.residential.furnished', [], 2],
    'mobilité : interdit' => ['fr.residential.mobility', [], 0],
    'droit commun : aucun plafond imposé' => ['fr.common_law', [], null],
]);

it('fixe le préavis du locataire selon la zone tendue et les cas listés', function (string $cle, array $donnees, ?int $mois): void {
    expect(regimeTermes($cle, $donnees)->tenantNoticeMonths)->toBe($mois);
})->with([
    'vide hors zone tendue' => ['fr.residential.unfurnished', [], 3],
    'vide, zone tendue déclarée fausse' => ['fr.residential.unfurnished', ['tense_zone' => false], 3],
    'vide en zone tendue' => ['fr.residential.unfurnished', ['tense_zone' => true], 1],
    'vide, perte d\'emploi' => ['fr.residential.unfurnished', ['tenant_notice_reason' => 'job_loss'], 1],
    'vide, motif absent' => ['fr.residential.unfurnished', ['tenant_notice_reason' => null], 3],
    'meublé' => ['fr.residential.furnished', [], 1],
    'mobilité' => ['fr.residential.mobility', [], 1],
]);

it('fixe le préavis du bailleur', function (string $cle, ?int $mois): void {
    expect(regimeTermes($cle)->landlordNoticeMonths)->toBe($mois);
})->with([
    'vide : 6 mois' => ['fr.residential.unfurnished', 6],
    'meublé : 3 mois' => ['fr.residential.furnished', 3],
    'mobilité : non vérifié' => ['fr.residential.mobility', null],
]);

it('calcule la prochaine révision au premier anniversaire puis à chaque révision', function (): void {
    $regime = regimeFr('fr.residential.unfurnished');
    $debut = CarbonImmutable::parse('2026-03-15');

    expect($regime->nextRevisionDate($debut, null, [])?->toDateString())->toBe('2027-03-15')
        ->and($regime->nextRevisionDate($debut, CarbonImmutable::parse('2027-03-15'), [])?->toDateString())->toBe('2028-03-15')
        ->and($regime->nextRevisionDate(CarbonImmutable::parse('2024-02-29'), null, [])?->toDateString())->toBe('2025-02-28');
});

it('exclut la révision des logements F et G, du bail mobilité et du droit commun', function (): void {
    $debut = CarbonImmutable::parse('2026-03-15');

    expect(regimeFr('fr.residential.unfurnished')->nextRevisionDate($debut, null, ['energy_class' => 'F']))->toBeNull()
        ->and(regimeFr('fr.residential.furnished')->nextRevisionDate($debut, null, ['energy_class' => 'G']))->toBeNull()
        ->and(regimeFr('fr.residential.furnished')->nextRevisionDate($debut, null, ['energy_class' => 'E']))->not->toBeNull()
        ->and(regimeFr('fr.residential.mobility')->nextRevisionDate($debut, null, []))->toBeNull()
        ->and(regimeFr('fr.common_law')->nextRevisionDate($debut, null, []))->toBeNull();
});

it('déclare la devise de l\'euro', function (string $cle): void {
    expect(regimeFr($cle)->currency())->toBe('EUR')->and(regimeFr($cle)->jurisdiction())->toBe('FR');
})->with(['fr.residential.unfurnished', 'fr.residential.furnished', 'fr.residential.mobility', 'fr.common_law']);

it('valide les champs de jurisdiction_data en liste blanche', function (): void {
    $validateur = app(JurisdictionDataValidator::class);
    $vide = regimeFr('fr.residential.unfurnished');

    $valide = $validateur->validate($vide, [
        'revision_index' => 'irl',
        'irl_reference_quarter' => '2026-T3',
        'tense_zone' => true,
        'rent_control' => false,
        'energy_class' => 'D',
    ]);

    expect($valide)->toBe([
        'revision_index' => 'irl',
        'irl_reference_quarter' => '2026-T3',
        'tense_zone' => true,
        'rent_control' => false,
        'energy_class' => 'D',
    ])->and($validateur->validate($vide, []))->toBe([]);
});

it('refuse un champ inconnu ou propre à un autre régime', function (string $cle, string $champ): void {
    try {
        app(JurisdictionDataValidator::class)->validate(regimeFr($cle), [$champ => true]);
        $this->fail('Le champ aurait dû être refusé.');
    } catch (ValidationException $e) {
        expect(array_keys($e->errors()))->toBe(['jurisdiction_data.'.$champ]);
    }
})->with([
    'champ inventé' => ['fr.residential.unfurnished', 'admin'],
    'étudiant hors meublé' => ['fr.residential.unfurnished', 'student'],
    'personne morale hors vide' => ['fr.residential.furnished', 'landlord_is_legal_entity'],
    'indice sur un bail mobilité non révisable' => ['fr.residential.mobility', 'revision_index'],
    'droit commun sans aucun champ' => ['fr.common_law', 'tense_zone'],
]);

it('refuse une valeur hors schéma', function (array $donnees, string $champ): void {
    try {
        app(JurisdictionDataValidator::class)->validate(regimeFr('fr.residential.furnished'), $donnees);
        $this->fail('La valeur aurait dû être refusée.');
    } catch (ValidationException $e) {
        expect(array_keys($e->errors()))->toBe(['jurisdiction_data.'.$champ]);
    }
})->with([
    'classe énergétique inconnue' => [['energy_class' => 'H'], 'energy_class'],
    'indice inconnu' => [['revision_index' => 'ilc'], 'revision_index'],
    'trimestre mal formé' => [['irl_reference_quarter' => '2026-T5'], 'irl_reference_quarter'],
    'booléen non booléen' => [['tense_zone' => 'peut-être'], 'tense_zone'],
    'restitution hors 1 à 2 mois' => [['deposit_return_months' => 3], 'deposit_return_months'],
]);

it('décrit un régime pour l\'API avec ses valeurs par défaut et son schéma', function (): void {
    $donnees = RegimeData::from(regimeFr('fr.residential.furnished'));
    $champs = array_column($donnees->fields, null, 'key');

    expect($donnees->key)->toBe('fr.residential.furnished')
        ->and($donnees->jurisdiction)->toBe('FR')
        ->and($donnees->currency)->toBe('EUR')
        ->and($donnees->defaults->defaultDurationMonths)->toBe(12)
        ->and($donnees->defaults->depositCapMonths)->toBe(2)
        ->and($champs['energy_class'])->toBe(['key' => 'energy_class', 'type' => 'enum', 'options' => ['A', 'B', 'C', 'D', 'E', 'F', 'G']])
        ->and($champs['student']['type'])->toBe('boolean')
        ->and($champs)->toHaveKeys(['revision_index', 'irl_reference_quarter', 'tense_zone', 'rent_control', 'deposit_return_months']);
});
