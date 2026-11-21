<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

const OPTIONS = '/api/v1/tenant/interventions/options';

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
});

/**
 * @return array<string, mixed>
 */
function optionsDuBail(object $test, string $leaseId): array
{
    $ligne = collect($test->getJson(OPTIONS)->assertOk()->json('data'))->firstWhere('lease_id', $leaseId);

    return is_array($ligne) ? $ligne : [];
}

it('401 sans jeton, 403 pour un compte d\'organisation', function (): void {
    auth()->forgetGuards();
    $this->getJson(OPTIONS)->assertUnauthorized();

    C::comme($this, $this->scene['owner']);
    $this->getJson(OPTIONS)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
});

it('rend les choix du bail : lots occupés, parties communes, natures en français, sans cache', function (): void {
    C::comme($this, $this->scene['tenant']);
    $reponse = $this->getJson(OPTIONS)->assertOk()->assertJsonCount(1, 'data');

    expect($reponse->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');

    $bail = $reponse->json('data.0');
    $plomberie = collect($bail['natures'])->firstWhere('key', 'plumbing');
    expect($bail['lease_id'])->toBe($this->scene['lease']->id)
        ->and($bail['label'])->toBe($this->scene['lease']->reference)
        ->and($bail['common_area_allowed'])->toBeTrue()
        ->and($bail['units'])->toHaveCount(1)
        ->and($bail['units'][0]['id'])->toBe($this->scene['unit']->id)
        ->and($bail['units'][0]['label'])->toContain(' - ')
        ->and($plomberie['label'])->toBe('Plomberie')
        ->and($plomberie['id'])->toBe(C::nature())
        ->and(array_keys($bail))->toBe(['lease_id', 'label', 'units', 'common_area_allowed', 'natures'])
        ->and(array_keys($bail['natures'][0]))->toBe(['id', 'key', 'label']);
});

it('n\'expose ni mandant, ni mandat, ni montant, ni adresse, ni métadonnée de nature', function (): void {
    C::comme($this, $this->scene['tenant']);
    $texte = $this->getJson(OPTIONS)->assertOk()->getContent();

    expect($texte)->not->toContain($this->scene['mandant']->id)->not->toContain($this->scene['mandate']->id)->not->toContain($this->scene['supplier']->id)
        ->not->toContain($this->scene['org']->id)->not->toContain('tenant_chargeable')->not->toContain('default_responsibility')->not->toContain('expense_semantic')
        ->not->toContain('works_limit')->not->toContain('ceiling')->not->toContain('address')->not->toContain('postal_code');
});

it('les identifiants rendus suffisent à signaler, au lot comme aux parties communes', function (): void {
    C::comme($this, $this->scene['tenant']);
    $bail = optionsDuBail($this, $this->scene['lease']->id);
    $nature = $bail['natures'][0]['id'];

    C::signaler($this, $this->scene, ['lease_id' => $bail['lease_id'], 'unit_id' => $bail['units'][0]['id'], 'nature_term_id' => $nature])->assertCreated();
    C::signaler($this, $this->scene, ['lease_id' => $bail['lease_id'], 'unit_id' => null, 'common_area' => true, 'nature_term_id' => $nature])->assertCreated()->assertJsonPath('data.place', 'Parties communes');
});

it('cloisonne par bail : le voisin et l\'autre agence ne voient que leur bail, un compte sans rattachement est refusé', function (): void {
    $voisin = C::voisin($this->scene['org']);
    $autre = C::agence();

    C::comme($this, $voisin['tenant']);
    $ids = array_column($this->getJson(OPTIONS)->assertOk()->json('data'), 'lease_id');
    expect($ids)->toBe([$voisin['lease']->id]);

    C::comme($this, $autre['tenant']);
    $ids = array_column($this->getJson(OPTIONS)->assertOk()->json('data'), 'lease_id');
    expect($ids)->toBe([$autre['lease']->id])->and($ids)->not->toContain($this->scene['lease']->id);

    C::comme($this, User::factory()->create());
    $this->getJson(OPTIONS)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
});

it('le colocataire voit les mêmes choix que le titulaire du bail', function (): void {
    $colocataire = C::colocataire($this->scene['org'], $this->scene['lease']);

    C::comme($this, $colocataire);
    $bail = optionsDuBail($this, $this->scene['lease']->id);

    expect($bail['units'][0]['id'])->toBe($this->scene['unit']->id);
});

it('exclut le bail résilié, le bail arrivé à échéance et le bail dont aucun lot n\'est encore occupé n\'offre pas les parties communes', function (): void {
    $resilie = C::voisin($this->scene['org']);
    $echu = C::voisin($this->scene['org']);
    C::resilier($this->scene['org'], $resilie['lease']);
    L::dans($this->scene['org'], fn () => Lease::query()->whereKey($echu['lease']->id)->update(['ends_on' => '2026-11-18']));

    foreach ([$resilie, $echu] as $voisin) {
        C::comme($this, $voisin['tenant']);
        $this->getJson(OPTIONS)->assertOk()->assertExactJson(['data' => []]);
        C::signaler($this, [...$this->scene, ...$voisin], ['unit_id' => null, 'common_area' => true])->assertUnprocessable()->assertJsonPath('code', 'intervention_lease_not_active');
    }

    $vide = C::voisin($this->scene['org']);
    DB::table('lease_units')->where('lease_id', $vide['lease']->id)->update(['valid_to' => '2026-06-01']);
    C::comme($this, $vide['tenant']);
    $bail = optionsDuBail($this, $vide['lease']->id);
    expect($bail['units'])->toBe([])->and($bail['common_area_allowed'])->toBeFalse();
});

it('les natures sont celles de l\'organisation du bail : ajout propre à l\'agence, valeur archivée absente', function (): void {
    $autre = C::agence();
    $propre = Term::factory()->create(['organization_id' => $this->scene['org']->id, 'vocabulary' => VocabularyKey::InterventionNature->value, 'key' => 'toiture', 'labels' => ['fr' => 'Toiture'], 'metadata' => []]);
    Term::factory()->create(['organization_id' => $this->scene['org']->id, 'vocabulary' => VocabularyKey::InterventionNature->value, 'key' => 'ancienne', 'labels' => ['fr' => 'Ancienne'], 'metadata' => [], 'archived_at' => now()]);

    C::comme($this, $this->scene['tenant']);
    $cles = array_column(optionsDuBail($this, $this->scene['lease']->id)['natures'], 'key');
    expect($cles)->toContain('toiture')->toContain('plumbing')->not->toContain('ancienne');
    C::signaler($this, $this->scene, ['nature_term_id' => $propre->id])->assertCreated();

    C::comme($this, $autre['tenant']);
    expect(array_column(optionsDuBail($this, $autre['lease']->id)['natures'], 'key'))->not->toContain('toiture');
});

it('limite le débit de lecture par compte', function (): void {
    C::comme($this, $this->scene['tenant']);

    for ($i = 0; $i < 60; $i++) {
        $this->getJson(OPTIONS)->assertOk();
    }

    $this->getJson(OPTIONS)->assertStatus(429);
});
