<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->autre = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->actingAs(M::titulaire($this->org));
    $this->lotEtranger = M::lot($this->autre);
    $this->partieEtrangere = M::partie($this->autre);
    $this->etranger = M::actif($this->autre, $this->lotEtranger, $this->partieEtrangere, ['reference' => 'M-2026-0099']);
    $this->etat = fn (): array => M::dans($this->autre, fn (): array => [
        Mandate::query()->findOrFail($this->etranger->id)->only(['lock_version', 'status', 'note', 'archived_at']),
        MandateUnit::query()->count(),
    ]);
});

it('répond mandate_not_found pour le mandat d\'une autre organisation sur chaque route qui désigne un mandat, lecture et écriture', function (): void {
    $avant = ($this->etat)();
    $echecs = [];
    $verifiees = 0;

    foreach (X::routes() as $route) {
        if (! str_contains(X::url($route, $this->org, 'mandat'), '/mandates/mandat')) {
            continue;
        }

        $verifiees++;
        X::constater($echecs, 'mandat étranger', $route, X::appeler($this, $route, $this->org, $this->etranger->id, $this->lot, $this->partie), 404, 'mandate_not_found');
    }

    expect($echecs)->toBe([])
        ->and($verifiees)->toBe(18)
        ->and(($this->etat)())->toBe($avant)
        ->and(M::dans($this->autre, fn () => Mandate::query()->count()))->toBe(1);
});

it('répond mandate_not_found pour la ligne de lot d\'un mandat étranger, même en la désignant sous un mandat de l\'organisation', function (): void {
    $mien = M::actif($this->org, $this->lot, $this->partie);
    $ligneEtrangere = M::dans($this->autre, fn () => MandateUnit::query()->where('mandate_id', $this->etranger->id)->firstOrFail());

    $this->postJson(M::url($this->org, "/{$mien->id}/units/{$ligneEtrangere->id}/end"), ['lock_version' => 1, 'end_date' => '2026-12-31'])
        ->assertNotFound()->assertJsonPath('code', 'mandate_unit_not_found');
    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie);
    $this->deleteJson(M::url($this->org, "/{$brouillon->id}/units/{$ligneEtrangere->id}"), ['lock_version' => 1])
        ->assertNotFound()->assertJsonPath('code', 'mandate_unit_not_found');
    expect(M::dans($this->autre, fn () => MandateUnit::query()->whereKey($ligneEtrangere->id)->exists()))->toBeTrue();
});

it('liste seulement les mandats de l\'organisation, et ignore un filtre qui désigne une ressource étrangère', function (): void {
    $mien = M::actif($this->org, $this->lot, $this->partie);

    $ids = fn (string $requete = ''): array => array_column($this->getJson(M::url($this->org, $requete))->assertOk()->json('data'), 'id');

    expect($ids())->toBe([$mien->id])
        ->and($ids("?unit={$this->lotEtranger->id}"))->toBe([])
        ->and($ids("?mandant={$this->partieEtrangere->id}"))->toBe([]);
    $mandants = array_column($this->getJson(M::url($this->org, '/mandants'))->assertOk()->json('data'), 'party_id');
    expect($mandants)->toBe([$this->partie->id]);
});

it('ne rattache jamais un lot, un mandant ou un type d\'une autre organisation à un mandat', function (): void {
    $this->postJson(M::url($this->org), M::payload($this->lotEtranger, $this->partie))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partieEtrangere))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(0);
});

it('refuse un curseur falsifié sans toucher à la base', function (string $curseur): void {
    $this->getJson(M::url($this->org, '?cursor='.urlencode($curseur)))->assertUnprocessable()->assertJsonValidationErrors('cursor');
})->with([
    'pas du base64' => ['%%%'],
    'base64 sans JSON' => [base64_encode('pas du json')],
    'JSON sans sens de page' => [base64_encode('{"id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03"}')],
    'identifiant injecté' => [base64_encode('{"id":"x\' OR 1=1 --","_pointsToNextItems":true}')],
    'colonne de tri étrangère' => [base64_encode('{"id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03","organization_id":"01a1e1ba-f7ae-70c8-b10b-7b2fbac39f03","_pointsToNextItems":true}')],
    'trop long' => [str_repeat('A', 1025)],
]);
