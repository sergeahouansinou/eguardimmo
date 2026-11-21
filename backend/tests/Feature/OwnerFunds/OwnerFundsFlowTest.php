<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
});

it('parcours nominal : loyer encaissé, mois clos, honoraires facturés et compensés, lot validé puis exécuté', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    expect(F::solde($this->org, AccountRole::OwnerPayable))->toBe(70000);

    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
    $item = $lot->json('data.items.0');
    expect($item['status'])->toBe('included')->and($item['bank_last4'])->toBe('4321');

    $valide = F::valider($this, $lot->json('data.id'))->assertOk();
    expect($valide->json('data.status'))->toBe('validated')
        ->and($valide->json('data.number'))->toStartWith('RV-2026-')
        ->and($valide->json('data.items.0.status'))->toBe('pending');

    $net = $valide->json('data.items.0.net_amount.amount');
    expect($net)->toBe(64120)
        ->and(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(64120)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(0);

    $this->actingAs(F::comptable($this->org));
    $execute = F::envoyer($this, 'POST', F::url($this->org, "/batches/{$lot->json('data.id')}/items/{$item['id']}/execute"), ['executed_on' => '2026-12-10', 'reference' => 'VIR-0001'])->assertOk();
    expect($execute->json('data.status'))->toBe('paid');

    expect(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(0)
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(-5880);
    $this->getJson(F::url($this->org, "/batches/{$lot->json('data.id')}"))->assertOk()->assertJsonPath('data.status', 'executed');
});
