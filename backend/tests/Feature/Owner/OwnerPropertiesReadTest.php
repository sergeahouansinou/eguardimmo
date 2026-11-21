<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateUnit;
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
});

it('liste les lots couverts avec site, adresse, surface et couverture', function (): void {
    $reponse = R::lire($this, $this->p['user'], '/properties')->assertOk()->assertJsonCount(1, 'data');
    $lot = $reponse->json('data.0');

    expect($lot['id'])->toBe($this->p['unit']->id)
        ->and($lot['reference'])->toBe($this->p['unit']->reference)
        ->and($lot)->toHaveKeys(['type', 'floor', 'surface_hundredths', 'property', 'agency', 'mandant', 'covered_from', 'covered_until'])
        ->and($lot['property'])->toHaveKeys(['name', 'address'])
        ->and($lot['agency'])->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($lot['covered_from'])->toBe('2026-01-01')->and($lot['covered_until'])->toBe('2028-12-31');
});

it('ne sert pas les lots d\'un autre propriétaire, même dans le même immeuble', function (): void {
    L::dans($this->org, fn () => $this->autre['unit']->forceFill(['property_id' => $this->p['unit']->property_id])->save());

    $texte = R::texte(R::lire($this, $this->p['user'], '/properties')->assertOk());

    expect($texte)->not->toContain($this->autre['unit']->id)->and($texte)->not->toContain($this->autre['unit']->reference);
    R::lire($this, $this->p['user'], '/properties/'.$this->autre['unit']->id)->assertNotFound()->assertJsonPath('code', 'owner_unit_not_found');
    R::lire($this, $this->p['user'], '/properties/'.fake()->uuid())->assertNotFound()->assertJsonPath('code', 'owner_unit_not_found');
    R::lire($this, $this->p['user'], '/properties/'.$this->p['unit']->id)->assertOk()->assertJsonPath('data.id', $this->p['unit']->id);
});

it('ne sert aucun identifiant de site ni de lot parent', function (): void {
    $texte = R::texte(R::lire($this, $this->p['user'], '/properties/'.$this->p['unit']->id)->assertOk());

    expect($texte)->not->toContain($this->p['unit']->property_id)->and($texte)->not->toContain('parent_unit');
});

it('cloisonne par organisation : le lot d\'une autre agence sous un mandat au même identifiant de mandant reste invisible', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $lotEtranger = R::lotDe($autreOrg, $piege = O::mandat($autreOrg, O::mandant($autreOrg, 'x@exemple.fr'), MandateStatus::Active, ['mandant_party_id' => $this->p['party']->id]));

    $texte = R::texte(R::lire($this, $this->p['user'], '/properties')->assertOk()->assertJsonCount(1, 'data'));

    expect($texte)->not->toContain($lotEtranger->id)->and($piege->id)->not->toBeNull();
    R::lire($this, $this->p['user'], '/properties/'.$lotEtranger->id)->assertNotFound();
});

it('suit la couverture : un lot retiré du mandat reste lisible tant que la fenêtre du mandant est ouverte, avec sa fin de couverture', function (): void {
    $second = L::lot($this->org);
    L::dans($this->org, fn () => MandateUnit::factory()->create(['mandate_id' => $this->p['mandate']->id, 'unit_id' => $second->id, 'valid_from' => '2026-01-01']));
    expect(R::lire($this, $this->p['user'], '/properties')->assertOk()->json('data'))->toHaveCount(2);

    L::dans($this->org, fn () => MandateUnit::query()->where('unit_id', $second->id)->update(['valid_to' => '2026-06-01']));
    $reponse = R::lire($this, $this->p['user'], '/properties/'.$second->id)->assertOk();
    expect($reponse->json('data.covered_until'))->toBe('2026-05-31');
});

it('pagine par curseur, dans les deux sens, sans doublon', function (): void {
    foreach (range(1, 4) as $_) {
        $lot = L::lot($this->org);
        L::dans($this->org, fn () => MandateUnit::factory()->create(['mandate_id' => $this->p['mandate']->id, 'unit_id' => $lot->id, 'valid_from' => '2026-01-01']));
    }
    $vus = [];
    $url = '/properties?per_page=2';

    do {
        $page = R::lire($this, $this->p['user'], $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/properties?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5)->and($vus)->toBe(collect($vus)->sort()->values()->all());
    $premiere = R::lire($this, $this->p['user'], '/properties?per_page=2')->assertOk();
    $deuxieme = R::lire($this, $this->p['user'], '/properties?per_page=2&cursor='.$premiere->json('meta.next_cursor'))->assertOk();
    $retour = R::lire($this, $this->p['user'], '/properties?per_page=2&cursor='.$deuxieme->json('meta.prev_cursor'))->assertOk();

    expect(collect($retour->json('data'))->pluck('id')->all())->toBe(collect($premiere->json('data'))->pluck('id')->all());
    R::lire($this, $this->p['user'], '/properties?cursor=zzz')->assertUnprocessable();
});

it('lit les lots en un nombre de requêtes indépendant de leur nombre', function (): void {
    $peu = R::requetes($this, $this->p['user'], '/properties?per_page=100');

    foreach (range(1, 5) as $_) {
        $lot = L::lot($this->org);
        L::dans($this->org, fn () => MandateUnit::factory()->create(['mandate_id' => $this->p['mandate']->id, 'unit_id' => $lot->id, 'valid_from' => '2026-01-01']));
    }

    expect(R::requetes($this, $this->p['user'], '/properties?per_page=100'))->toBe($peu);
});

it('refuse sans session et sans profil propriétaire', function (): void {
    $this->getJson('/api/v1/owner/properties')->assertUnauthorized();
    R::lire($this, T::locataire($this->org)['user'], '/properties')->assertForbidden();
});

it('ignore un lot couvert dont la fiche est introuvable au lieu de faire échouer la liste', function (): void {
    $orphelin = fake()->uuid();
    L::dans($this->org, fn () => MandateUnit::factory()->create(['mandate_id' => $this->p['mandate']->id, 'unit_id' => $orphelin, 'valid_from' => '2026-01-01']));

    $ids = collect(R::lire($this, $this->p['user'], '/properties')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->p['unit']->id]);
    R::lire($this, $this->p['user'], '/properties/'.$orphelin)->assertNotFound()->assertJsonPath('code', 'owner_unit_not_found');
});
