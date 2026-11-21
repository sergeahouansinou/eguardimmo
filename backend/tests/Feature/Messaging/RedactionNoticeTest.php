<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    config(['notifications.push.driver' => 'fake', 'sanctum.stateful' => ['agence.eguardimmo.test']]);
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->base = "/api/v1/org/{$this->org->id}/conversations";
    $this->admin = L::membre($this->org, MemberRole::Admin);
    activerDeuxFacteurs($this->admin);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->autreGestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function retraitParAdmin(mixed $test, string $filId, string $messageId, string $motif = 'Donnée personnelle envoyée par erreur'): void
{
    O::preuve($test);
    O::comme($test, $test->admin)->postJson("{$test->base}/{$filId}/messages/{$messageId}/redaction", ['reason' => $motif], O::ORIGINE)->assertOk();
}

function retraits(string $type): array
{
    return DB::table('notifications')->where('type', $type)->get()->all();
}

it('prévient le locataire quand l\'organisation retire son message, sans motif ni texte', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 11:00:00'));
    $message = M::repondre($this->org, $this->locataire['user'], $fil, 'Mon IBAN FR76 3000', MessageSide::Tenant);

    retraitParAdmin($this, $fil->id, $message->id, 'IBAN envoyé par erreur');

    $lignes = retraits('tenant.message_redacted');
    expect($lignes)->toHaveCount(1)
        ->and($lignes[0]->user_id)->toBe($this->locataire['user']->id)
        ->and($lignes[0]->link)->toBe("/messages/{$fil->id}")
        ->and(json_encode($lignes))->not->toContain('IBAN')->not->toContain('FR76');
});

it('prévient seulement le membre de l\'équipe dont l\'administrateur retire le message', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 11:00:00'));
    $message = M::repondre($this->org, $this->autreGestionnaire, $fil, 'Message du collègue');

    retraitParAdmin($this, $fil->id, $message->id);

    expect(array_column(retraits('messaging.message_redacted'), 'user_id'))->toBe([$this->autreGestionnaire->id]);
});

it('prévient le seul compte du mandant qui a écrit', function (): void {
    $representant = User::factory()->create(['email' => 'rep@exemple.fr']);
    O::acces($this->org, $this->mandant['party'], $representant, OwnerAccessRole::Representative);
    $fil = M::filMandant($this->org, $this->gestionnaire, $this->mandant['party']->id);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 11:00:00'));
    $message = M::repondre($this->org, $this->mandant['user'], $fil, 'Message du mandant', MessageSide::Owner);

    retraitParAdmin($this, $fil->id, $message->id);

    expect(array_column(retraits('owner.message_redacted'), 'user_id'))->toBe([$this->mandant['user']->id]);
});

it('ne prévient personne quand l\'auteur retire son propre message', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    $message = M::repondre($this->org, $this->locataire['user'], $fil, 'Oups', MessageSide::Tenant);

    T::comme($this, $this->locataire['user'])->postJson("/api/v1/tenant/conversations/{$fil->id}/messages/{$message->id}/redaction")->assertOk();

    expect(retraits('tenant.message_redacted'))->toBeEmpty()->and(retraits('messaging.message_redacted'))->toBeEmpty();
});
