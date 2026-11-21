<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Mandates\Enums\MandateStatus;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->p = R::proprietaire($this->org);
    $this->autre = R::proprietaire($this->org, 'bob@exemple.fr');
    $this->b = R::bail($this->org, $this->p['unit']);
});

it('liste les baux du mandant avec locataire, lot principal et dates', function (): void {
    $reponse = R::lire($this, $this->p['user'], '/leases')->assertOk()->assertJsonCount(1, 'data');
    $bail = $reponse->json('data.0');

    expect($bail)->toMatchArray(['id' => $this->b['lease']->id, 'status' => 'signed', 'phase' => 'running', 'starts_on' => '2026-01-01', 'end_date' => '2028-12-31'])
        ->and($bail['agency'])->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($bail['main_unit']['id'])->toBe($this->p['unit']->id)
        ->and($bail['tenants'])->toBe([['display_name' => 'Marie Durand', 'role' => 'tenant', 'valid_from' => '2026-01-01', 'end_date' => null]]);
});

it('sert le détail avec loyer, périodicité et lots, sans coordonnée ni donnée interne', function (): void {
    L::dans($this->org, fn () => $this->b['lease']->forceFill([
        'note' => 'NOTE-DU-BAIL', 'termination_reason' => 'MOTIF-CONGE', 'custom_fields' => ['k' => 'CHAMP-PERSO'],
        'jurisdiction_data' => ['secret' => 'DONNEE-JURIDICTION'], 'signed_file_id' => 'f4d6b1c0-0000-7000-8000-000000000002',
        'payment_method' => 'direct_debit',
    ])->save());

    $reponse = R::lire($this, $this->p['user'], '/leases/'.$this->b['lease']->id)->assertOk();
    $texte = R::texte($reponse);

    expect($reponse->json('data.terms.0.amount'))->toBe(['amount' => 65000, 'currency' => 'EUR'])
        ->and($reponse->json('data.periodicity'))->toBe('monthly')->and($reponse->json('data.units'))->toHaveCount(1)
        ->and($texte)->not->toContain('NOTE-DU-BAIL')->and($texte)->not->toContain('MOTIF-CONGE')->and($texte)->not->toContain('CHAMP-PERSO')
        ->and($texte)->not->toContain('DONNEE-JURIDICTION')->and($texte)->not->toContain('signed_file')->and($texte)->not->toContain('payment_method')
        ->and($texte)->not->toContain('secret@exemple.fr')->and($texte)->not->toContain($this->b['tenant']->id)->and($texte)->not->toContain('email')->and($texte)->not->toContain('phone');
});

it('ne montre ni garant ni occupant, seulement les locataires, et anonymise une fiche effacée', function (): void {
    $garant = T::colocataire($this->org, $this->b['lease'], [], LeasePartyRole::Guarantor);
    $occupant = T::colocataire($this->org, $this->b['lease'], [], LeasePartyRole::Occupant);
    $efface = T::colocataire($this->org, $this->b['lease'], [], LeasePartyRole::Tenant);
    L::dans($this->org, fn () => $efface->forceFill(['anonymized_at' => now(), 'display_name' => 'NOM-EFFACE'])->save());

    $reponse = R::lire($this, $this->p['user'], '/leases/'.$this->b['lease']->id)->assertOk();
    $noms = collect($reponse->json('data.tenants'))->pluck('display_name')->all();

    expect($noms)->toContain('Marie Durand')->toContain('Locataire anonymisé')->not->toContain('NOM-EFFACE')->and($noms)->toHaveCount(2)
        ->and(R::texte($reponse))->not->toContain($garant->display_name)->and(R::texte($reponse))->not->toContain($occupant->display_name);
});

it('ne sert pas le bail d\'un autre propriétaire, de la même agence ou d\'une autre', function (): void {
    $sien = R::bail($this->org, $this->autre['unit'], [], 'Paul Autre');
    $autreOrg = T::organisation('Immo Loire');
    $etranger = O::mandat($autreOrg, O::mandant($autreOrg, 'x@exemple.fr'), MandateStatus::Active, ['mandant_party_id' => $this->p['party']->id]);
    $bailEtranger = R::bail($autreOrg, R::lotDe($autreOrg, $etranger), [], 'Louis Loire');

    $texte = R::texte(R::lire($this, $this->p['user'], '/leases')->assertOk()->assertJsonCount(1, 'data'));

    expect($texte)->not->toContain($sien['lease']->id)->and($texte)->not->toContain('Paul Autre')->and($texte)->not->toContain($bailEtranger['lease']->id)->and($texte)->not->toContain('Louis Loire');
    R::lire($this, $this->p['user'], '/leases/'.$sien['lease']->id)->assertNotFound()->assertJsonPath('code', 'owner_lease_not_found');
    R::lire($this, $this->p['user'], '/leases/'.$bailEtranger['lease']->id)->assertNotFound();
    R::lire($this, $this->p['user'], '/leases/'.fake()->uuid())->assertNotFound()->assertJsonPath('code', 'owner_lease_not_found');
    R::lire($this, $this->autre['user'], '/leases/'.$this->b['lease']->id)->assertNotFound();
});

it('masque les baux brouillon et annulé, et ceux qui précèdent ou suivent la couverture du mandat', function (): void {
    $brouillon = R::bail($this->org, $this->p['unit'], ['status' => LeaseStatus::Draft, 'starts_on' => '2026-02-01', 'ends_on' => '2027-02-01']);
    $annule = R::bail($this->org, $this->p['unit'], ['status' => LeaseStatus::Cancelled, 'starts_on' => '2026-03-01', 'ends_on' => '2027-03-01']);
    $avant = R::bail($this->org, $this->p['unit'], ['status' => LeaseStatus::Terminated, 'starts_on' => '2023-01-01', 'ends_on' => '2025-12-31']);
    $apres = R::bail($this->org, $this->p['unit'], ['starts_on' => '2029-01-01', 'ends_on' => '2032-01-01']);

    $ids = collect(R::lire($this, $this->p['user'], '/leases')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->b['lease']->id])
        ->and($ids)->not->toContain($brouillon['lease']->id, $annule['lease']->id, $avant['lease']->id, $apres['lease']->id);
});

it('montre un bail en cours au début de la couverture, et un bail résilié sur la période couverte', function (): void {
    $enCours = R::bail($this->org, $this->p['unit'], ['status' => LeaseStatus::Terminated, 'starts_on' => '2025-06-01', 'ends_on' => '2026-03-01']);

    $ids = collect(R::lire($this, $this->p['user'], '/leases')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toContain($enCours['lease']->id)->toContain($this->b['lease']->id);
});

it('garde les baux lisibles pendant la fenêtre de 12 mois d\'un mandat terminé puis les ferme', function (): void {
    L::dans($this->org, fn () => $this->p['mandate']->forceFill(['status' => MandateStatus::Terminated, 'ends_on' => '2026-06-01'])->save());

    R::lire($this, $this->p['user'], '/leases')->assertOk()->assertJsonCount(1, 'data');

    $this->travelTo(CarbonImmutable::parse('2027-05-31 08:00:00'));
    R::lire($this, $this->p['user'], '/leases')->assertOk()->assertJsonCount(1, 'data');

    $this->travelTo(CarbonImmutable::parse('2027-06-01 08:00:00'));
    R::lire($this, $this->p['user'], '/leases')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->p['user'], '/leases/'.$this->b['lease']->id)->assertNotFound();
});

it('restreint par ?agency= et refuse une agence hors clé', function (): void {
    R::lire($this, $this->p['user'], '/leases?agency='.$this->org->id)->assertOk()->assertJsonCount(1, 'data');
    $autreOrg = T::organisation('Immo Loire');
    R::lire($this, $this->p['user'], '/leases?agency='.$autreOrg->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
});

it('pagine par curseur sans doublon', function (): void {
    foreach (range(1, 4) as $i) {
        R::bail($this->org, $this->p['unit'], ['starts_on' => sprintf('2026-0%d-01', $i + 1), 'ends_on' => '2028-12-01']);
    }
    $vus = [];
    $url = '/leases?per_page=2';

    do {
        $page = R::lire($this, $this->p['user'], $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/leases?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5);
    R::lire($this, $this->p['user'], '/leases?cursor=%%%')->assertUnprocessable();
});

it('lit les baux en un nombre de requêtes indépendant de leur nombre, avec une agence ou deux', function (): void {
    $peu = R::requetes($this, $this->p['user'], '/leases?per_page=100');

    foreach (range(1, 5) as $_) {
        R::bail($this->org, $this->p['unit'], ['starts_on' => '2026-02-01', 'ends_on' => '2028-12-01']);
    }

    expect(R::requetes($this, $this->p['user'], '/leases?per_page=100'))->toBe($peu);
    expect(R::requetes($this, $this->p['user'], '/leases/'.$this->b['lease']->id))->toBeLessThanOrEqual(30);
});

it('refuse sans session et sans profil propriétaire', function (): void {
    $this->getJson('/api/v1/owner/leases')->assertUnauthorized();
    R::lire($this, T::locataire($this->org)['user'], '/leases')->assertForbidden();
});
