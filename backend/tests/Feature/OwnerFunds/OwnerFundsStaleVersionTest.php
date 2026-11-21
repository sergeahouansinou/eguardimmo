<?php

declare(strict_types=1);

use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $this->lot = $lot->json('data.id');
    $this->version = $lot->json('data.lock_version');
    $this->item = $lot->json('data.items.0.id');
});

it('la validation exige lock_version', function (): void {
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"))->assertStatus(422)->assertJsonValidationErrors('lock_version');
});

it('la validation d\'un lot lu avant une modification est refusée 409 payout_stale_version, sans rien écrire', function (): void {
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/items/{$this->item}/exclude"), ['lock_version' => $this->version])->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/items/{$this->item}/include"), ['lock_version' => $this->version + 1])->assertOk();

    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"), ['lock_version' => $this->version])->assertStatus(409)->assertJsonPath('code', 'payout_stale_version');

    expect($this->getJson(F::url($this->org, "/batches/{$this->lot}"))->json('data.status'))->toBe('draft');
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"), ['lock_version' => $this->version + 2])->assertOk();
});

it('l\'annulation exige lock_version et refuse une version périmée', function (): void {
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/cancel"), ['reason' => 'Erreur de saisie'])->assertStatus(422)->assertJsonValidationErrors('lock_version');
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/cancel"), ['reason' => 'Erreur de saisie', 'lock_version' => $this->version + 5])->assertStatus(409)->assertJsonPath('code', 'payout_stale_version');

    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/cancel"), ['reason' => 'Erreur de saisie', 'lock_version' => $this->version])->assertOk()->assertJsonPath('data.status', 'cancelled');
});

it('un rejeu de la validation sous la même clé et la même version est idempotent ; une autre version sous la même clé est refusée', function (): void {
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"), ['lock_version' => $this->version], 'validation-stale-1')->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"), ['lock_version' => $this->version], 'validation-stale-1')->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$this->lot}/validate"), ['lock_version' => $this->version + 1], 'validation-stale-1')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});
