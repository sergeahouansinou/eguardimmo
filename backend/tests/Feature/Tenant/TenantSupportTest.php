<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(T::AUJOURDHUI));
    $this->moi = T::locataire(T::organisation());
});

it('permet au locataire d\'ouvrir et de relire une demande d\'assistance depuis l\'espace tenant', function (): void {
    $id = (string) $this->actingAs($this->moi['user'])->postJson('/api/v1/support/tickets', [
        'space' => 'tenant', 'category' => 'documents', 'subject' => 'Quittance manquante', 'body' => 'Je ne retrouve pas la quittance de mars.',
    ])->assertCreated()->assertJsonPath('data.status', 'open')->json('data.id');

    T::comme($this, $this->moi['user'])->getJson('/api/v1/support/tickets')->assertOk()->assertJsonPath('data.0.id', $id);
    T::comme($this, $this->moi['user'])->getJson("/api/v1/support/tickets/{$id}")->assertOk()->assertJsonPath('data.requester.name', $this->moi['user']->name);
    T::comme($this, $this->moi['user'])->postJson("/api/v1/support/tickets/{$id}/messages", ['body' => 'Merci de votre aide.'])->assertOk();
});

it('ne montre jamais la demande d\'un locataire à un autre', function (): void {
    $id = (string) $this->actingAs($this->moi['user'])->postJson('/api/v1/support/tickets', [
        'space' => 'tenant', 'category' => 'account', 'subject' => 'Mon compte', 'body' => 'Bonjour.',
    ])->assertCreated()->json('data.id');
    $voisin = T::locataire(T::organisation('Immo Loire'));

    T::comme($this, $voisin['user'])->getJson("/api/v1/support/tickets/{$id}")->assertNotFound();
    T::comme($this, $voisin['user'])->getJson('/api/v1/support/tickets')->assertOk()->assertJsonCount(0, 'data');
});
