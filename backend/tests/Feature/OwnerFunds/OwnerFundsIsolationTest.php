<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $this->lot = $lot->json('data.id');
    $this->item = $lot->json('data.items.0.id');
    $this->retenue = F::envoyer($this, 'POST', F::url($this->org, '/holds'), ['mandant_party_id' => $this->mandant->id, 'kind' => 'reserve', 'amount' => 100, 'reason' => 'other'])->assertCreated()->json('data.id');
    $this->autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($this->autre));
});

it('IDOR : le lot, la ligne, la retenue et le mandant d\'une autre agence répondent 404 avec leur code', function (): void {
    $u = fn (string $chemin) => F::url($this->autre, $chemin);

    $this->getJson($u("/batches/{$this->lot}"))->assertNotFound()->assertJsonPath('code', 'payout_batch_not_found');
    $this->get($u("/batches/{$this->lot}/export"))->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/validate"), ['lock_version' => 1])->assertNotFound()->assertJsonPath('code', 'payout_batch_not_found');
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/cancel"), ['reason' => 'Test croisé', 'lock_version' => 1])->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/items/{$this->item}/include"), ['lock_version' => 1])->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/items/{$this->item}/exclude"), ['lock_version' => 1])->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/items/{$this->item}/execute"), ['executed_on' => '2026-12-10'])->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/items/{$this->item}/fail"), ['reason' => 'Test croisé', 'lock_version' => 1])->assertNotFound();
    F::envoyer($this, 'POST', $u("/batches/{$this->lot}/items/{$this->item}/return"), ['reason' => 'Test croisé', 'lock_version' => 1])->assertNotFound();
    F::envoyer($this, 'POST', $u("/holds/{$this->retenue}/release"))->assertNotFound()->assertJsonPath('code', 'payout_hold_not_found');
    $this->getJson($u("/mandants/{$this->mandant->id}/account"))->assertNotFound()->assertJsonPath('code', 'owner_funds_mandant_not_found');
    F::envoyer($this, 'POST', $u('/holds'), ['mandant_party_id' => $this->mandant->id, 'kind' => 'full', 'reason' => 'dispute'])->assertNotFound();
    F::envoyer($this, 'POST', $u('/batches'), ['mandant_ids' => [$this->mandant->id]])->assertNotFound();
});

it('les listes d\'une autre agence sont vides', function (): void {
    foreach (['/batches', '/holds', '/fees'] as $chemin) {
        $this->getJson(F::url($this->autre, $chemin))->assertOk()->assertJsonCount(0, 'data');
    }

    expect($this->getJson(F::url($this->autre, '/payouts/preview'))->assertOk()->json('data'))->toBe([])
        ->and($this->getJson(F::url($this->autre, '/trust/coverage'))->json('data.covered'))->toBeTrue();
});

it('rien n\'a bougé chez le propriétaire des données après les tentatives croisées', function (): void {
    F::envoyer($this, 'POST', F::url($this->autre, "/batches/{$this->lot}/cancel"), ['reason' => 'Test croisé', 'lock_version' => 1])->assertNotFound();

    expect(L::dans($this->org, fn () => DB::table('payout_batches')->where('id', $this->lot)->value('status')))->toBe('draft')
        ->and(L::dans($this->org, fn () => DB::table('payout_holds')->whereNull('released_at')->count()))->toBe(1);
});
