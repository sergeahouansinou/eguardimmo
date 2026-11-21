<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    $this->equipe = N::equipe($this->org);
    activerDeuxFacteurs($this->equipe['accountant']);
});

it('un reversement exécuté prévient le propriétaire et le comptable, pas le gestionnaire, sans montant ni IBAN', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    $valide = F::valider($this, $lot)->assertOk();
    $this->actingAs($this->equipe['accountant']);
    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$lot}/items/{$valide->json('data.items.0.id')}/execute"), ['executed_on' => '2026-12-10'])->assertOk();

    expect(N::nombre($this->equipe['owner'], Type::OwnerFundsPayoutExecuted))->toBe(1)
        ->and(N::nombre($this->equipe['accountant'], Type::OwnerFundsPayoutExecuted))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::OwnerFundsPayoutExecuted))->toBe(0);

    foreach (Notification::query()->get() as $notification) {
        expect($notification->title.$notification->body)->not->toContain('64120')->not->toContain('4321');
    }
});

it('un virement échoué ou retourné prévient l\'équipe habilitée, une seule fois par ligne', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    $valide = F::valider($this, $lot)->assertOk();
    $item = $valide->json('data.items.0.id');

    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$lot}/items/{$item}/fail"), ['reason' => 'IBAN refusé'])->assertOk();

    expect(N::nombre($this->equipe['owner'], Type::OwnerFundsPayoutFailed))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::OwnerFundsPayoutFailed))->toBe(0);
});
