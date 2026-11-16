<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeasesSecurityContext as X;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->autre = L::organisation();
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->etranger = R::bailSigne($this->autre, ['reference' => 'BL-2026-0099']);
    $this->lotEtranger = L::lot($this->autre);
    $this->partieEtrangere = L::partie($this->autre);
    R::occuper($this->autre, $this->etranger, $this->lotEtranger);
    R::lier($this->autre, $this->etranger, $this->partieEtrangere);
});

it('répond lease_not_found pour le bail d\'une autre organisation sur chaque route qui désigne un bail, lecture et écriture', function (): void {
    $avant = L::dans($this->autre, fn (): array => Lease::query()->findOrFail($this->etranger->id)->only(['lock_version', 'status', 'note', 'archived_at']));
    $echecs = [];
    $verifiees = 0;

    foreach (X::routes() as $route) {
        if (! str_contains(X::url($route, $this->org, 'bail', $this->lot, $this->partie), '/leases/bail')) {
            continue;
        }

        $verifiees++;
        X::constater($echecs, 'bail étranger', $route, X::appeler($this, $route, $this->org, $this->etranger->id, $this->lot, $this->partie), 404, 'lease_not_found');
    }

    $apres = L::dans($this->autre, fn (): array => Lease::query()->findOrFail($this->etranger->id)->only(['lock_version', 'status', 'note', 'archived_at']));

    expect($echecs)->toBe([])
        ->and($verifiees)->toBe(16)
        ->and($apres)->toBe($avant)
        ->and(L::dans($this->autre, fn () => Lease::query()->count()))->toBe(1);
});

it('répond lease_not_found pour le bail d\'une autre organisation même avec les lignes de ce bail', function (): void {
    $this->postJson(R::url($this->org, "/{$this->etranger->id}/units"), ['lock_version' => 1, 'unit_id' => $this->lot->id, 'valid_from' => '2026-12-01'])
        ->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    $this->postJson(R::url($this->org, "/{$this->etranger->id}/parties"), ['lock_version' => 1, 'party_id' => $this->partieEtrangere->id, 'role' => 'tenant'])
        ->assertNotFound()->assertJsonPath('code', 'lease_not_found');
});

it('renvoie une liste vide quand le filtre unit ou party désigne une ressource d\'une autre organisation', function (): void {
    R::bailSigne($this->org, ['reference' => 'BL-2026-0001']);

    $this->getJson(R::url($this->org, "?unit={$this->lotEtranger->id}"))->assertOk()->assertJsonPath('data', []);
    $this->getJson(R::url($this->org, "?party={$this->partieEtrangere->id}"))->assertOk()->assertJsonPath('data', []);
    $this->getJson(R::url($this->org, "?unit={$this->lotEtranger->id}&party={$this->partieEtrangere->id}"))->assertOk()->assertJsonPath('data', []);
    $this->getJson(R::url($this->org))->assertOk()->assertJsonCount(1, 'data');
});

it('ne lit ni lot, ni partie, ni régime d\'une autre organisation par les lectures par identifiant', function (): void {
    $this->getJson(R::url($this->org, "/tenancies?parties[]={$this->partieEtrangere->id}"))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $this->getJson(R::url($this->org, "/occupancy?units[]={$this->lotEtranger->id}"))->assertNotFound();
    $this->getJson(R::url($this->org, "/regimes?unit={$this->lotEtranger->id}"))->assertNotFound();
});

it('refuse un curseur falsifié sans toucher à la base', function (string $curseur): void {
    $this->getJson(R::url($this->org, '?cursor='.urlencode($curseur)))->assertUnprocessable()->assertJsonValidationErrors('cursor');
})->with([
    'pas du base64' => ['%%%'],
    'base64 sans JSON' => [base64_encode('pas du json')],
    'JSON sans sens de page' => [base64_encode('{"starts_on":"2026-01-01","id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03"}')],
    'date injectée' => [base64_encode('{"starts_on":"2026-01-01\' OR 1=1 --","id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03","_pointsToNextItems":true}')],
    'identifiant injecté' => [base64_encode('{"starts_on":"2026-01-01","id":"x\' OR 1=1 --","_pointsToNextItems":true}')],
    'colonne de tri étrangère' => [base64_encode('{"starts_on":"2026-01-01","id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03","organization_id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03","_pointsToNextItems":true}')],
    'trop long' => [str_repeat('A', 1025)],
]);
