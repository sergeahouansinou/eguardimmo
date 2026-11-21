<?php

declare(strict_types=1);

use App\Modules\Maintenance\Events\InterventionQualified;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use Tests\Feature\Maintenance\MaintenanceContext as C;
use Tests\Feature\Notifications\NotificationsContext as N;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->equipe = N::equipe($this->scene['org']);
});

it('notifie le locataire et l\'équipe à chaque étape, aux bons destinataires, sans aucun texte libre', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $locataire = $this->scene['tenant'];

    foreach ([Type::TenantRequestQualified, Type::TenantVisitScheduled, Type::TenantWorkCompleted] as $type) {
        expect(N::nombre($locataire, $type))->toBeGreaterThanOrEqual(1, $type->value);
    }

    expect(N::nombre($this->equipe['owner'], Type::MaintenanceRequestReceived))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::MaintenanceRequestReceived))->toBe(1)
        ->and(N::nombre($this->equipe['accountant']))->toBe(0)
        ->and(N::nombre($locataire, Type::MaintenanceRequestReceived))->toBe(0)
        ->and(N::premiere($locataire, Type::TenantWorkCompleted)->link)->toBe("/interventions/{$id}");

    foreach (Notification::query()->get() as $notification) {
        expect($notification->title.$notification->body)->not->toContain('évier')->not->toContain('Siphon')->not->toContain('Plomberie Dupont');
    }
});

it('notifie l\'équipe d\'une demande de report faite par le locataire', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $this->scene, $id);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    $visite = $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'presence_required' => true])->assertCreated()->json('data.id');

    C::comme($this, $this->scene['tenant']);
    $this->postJson(C::BASE."/tenant/interventions/{$id}/visits/{$visite}/reschedule-request", ['requested_on' => '2026-11-25', 'slot' => 'afternoon'])->assertOk();

    expect(N::nombre($this->equipe['owner'], Type::MaintenanceRescheduleRequested))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::MaintenanceRescheduleRequested))->toBe(1)
        ->and(N::nombre($this->equipe['accountant']))->toBe(0);
});

it('notifie le locataire d\'un classement sans suite', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/decline"), ['lock_version' => 1, 'reason' => 'duplicate', 'note' => 'Doublon.'])->assertOk();

    expect(N::nombre($this->scene['tenant'], Type::TenantRequestDeclined))->toBe(1);
});

it('notifie la décision du mandant et l\'expiration de la demande, sans valoir accord', function (): void {
    $id = C::enDevis($this, $this->scene, 60000);
    $devis = (string) C::devis($this, $this->scene, $id, 60000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();

    $this->travelTo(now()->addHours(49));
    $this->artisan('maintenance:expire-approvals')->assertSuccessful();
    $this->artisan('maintenance:expire-approvals')->assertSuccessful();

    expect(N::nombre($this->equipe['owner'], Type::MaintenanceApprovalExpired))->toBe(1)
        ->and(N::nombre($this->equipe['accountant']))->toBe(0);

    $autre = C::enDevis($this, $this->scene, 60000);
    $second = (string) C::devis($this, $this->scene, $autre, 60000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/quotes/{$second}/submit"))->assertOk();
    $demande = (string) $this->getJson(C::url($this->scene['org'], "/interventions/{$autre}"))->json('data.approvals.0.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/approvals/{$demande}/record-decision"), ['decision' => 'accept', 'proof_file_id' => C::fichier($this, $this->scene, $autre, 'proof')])->assertOk();

    expect(N::nombre($this->equipe['owner'], Type::MaintenanceApprovalDecided))->toBe(1);
});

it('un événement rejoué ne crée pas une seconde notification', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $intervention = Intervention::query()->withoutGlobalScopes()->findOrFail($id);

    InterventionQualified::dispatch($id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);
    InterventionQualified::dispatch($id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);

    expect(N::nombre($this->scene['tenant'], Type::TenantRequestQualified))->toBe(1);
});
