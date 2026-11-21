<?php

declare(strict_types=1);

use App\Modules\Maintenance\Mail\ApprovalNoticeMail;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Parties\Models\ContactPoint;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence(50000);
});

/**
 * @param  array<string, mixed>  $scene
 */
function urgenceEngagee(object $test, array $scene, int $estime = 90000): string
{
    $id = C::enDevis($test, $scene, $estime, ['priority' => 'urgent']);
    $test->postJson(C::url($scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk();

    return $id;
}

it('la priorité urgente ne se pose pas par un simple PATCH', function (): void {
    $id = C::enDevis($this, $this->scene, 90000);

    $this->patchJson(C::url($this->scene['org'], "/interventions/{$id}"), ['lock_version' => 3, 'priority' => 'urgent'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])
        ->assertUnprocessable()->assertJsonPath('code', 'intervention_emergency_not_allowed');
});

it('un changement de priorité autorisé est journalisé sans texte libre', function (): void {
    $id = C::enDevis($this, $this->scene, 20000);

    $this->patchJson(C::url($this->scene['org'], "/interventions/{$id}"), ['lock_version' => 3, 'priority' => 'low'])->assertOk()->assertJsonPath('data.priority', 'low');

    $ligne = AuditLog::query()->where('action', 'maintenance.intervention.priority_changed')->firstOrFail();
    expect($ligne->metadata)->toMatchArray(['from' => 'normal', 'to' => 'low']);
});

it('l\'avenant d\'une intervention engagée en urgence repasse par l\'accord du mandant', function (): void {
    $id = urgenceEngagee($this, $this->scene);
    $initial = (string) C::devis($this, $this->scene, $id, 75000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$initial}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$initial}/accept"))->assertOk();

    $avenant = (string) C::devis($this, $this->scene, $id, 30000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$avenant}/submit"))->assertOk();
    $this->getJson(C::url($this->scene['org'], "/interventions/{$id}"))->assertJsonPath('data.approvals.0.status', 'pending')->assertJsonPath('data.approvals.0.amount.amount', 126000);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$avenant}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
});

it('un avenant jamais soumis ne s\'accepte pas non plus sans accord', function (): void {
    $id = urgenceEngagee($this, $this->scene);
    $avenant = (string) C::devis($this, $this->scene, $id, 90000, ['kind' => 'supplement'])->assertCreated()->json('data.id');

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$avenant}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
});

it('la dérogation d\'urgence est bornée : au-delà, l\'engagement comme le devis exigent l\'accord', function (): void {
    config(['maintenance.emergency_ceiling_minor' => 100000]);
    $id = C::enDevis($this, $this->scene, 150000, ['priority' => 'urgent']);

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])
        ->assertUnprocessable()->assertJsonPath('code', 'intervention_emergency_not_allowed');

    $autre = C::enDevis($this, $this->scene, 90000, ['priority' => 'urgent']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk();
    $devis = (string) C::devis($this, $this->scene, $autre, 90000, ['kind' => 'supplement'])->assertCreated()->json('data.id');

    $this->postJson(C::url($this->scene['org'], "/interventions/{$autre}/quotes/{$devis}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
});

it('le devis dans la borne de l\'engagement d\'urgence passe sans accord', function (): void {
    $id = urgenceEngagee($this, $this->scene);
    $devis = (string) C::devis($this, $this->scene, $id, 75000, ['kind' => 'supplement'])->assertCreated()->json('data.id');

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    expect(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->approval_basis->value)->toBe('emergency');
});

it('le contrôle quotidien ne dispense que le montant engagé en urgence', function (): void {
    $id = urgenceEngagee($this, $this->scene);
    $initial = (string) C::devis($this, $this->scene, $id, 75000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$initial}/accept"))->assertOk();
    $this->artisan('maintenance:verify')->expectsOutputToContain('Aucune anomalie.')->assertSuccessful();

    $avenant = (string) C::devis($this, $this->scene, $id, 30000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    DB::table('intervention_quotes')->where('id', $avenant)->update(['status' => 'accepted']);

    $this->artisan('maintenance:verify')->expectsOutputToContain('au-dessus du plafond')->assertFailed();
});

it('le courriel d\'urgence n\'annonce pas un montant de 0,00 quand il n\'y a pas d\'estimation', function (): void {
    Mail::fake();
    L::dans($this->scene['org'], fn () => ContactPoint::query()->create(['party_id' => $this->scene['mandant']->id, 'type' => 'email', 'value' => 'mandant@exemple.test', 'is_primary' => true, 'primary_slot' => 1]));
    $sans = C::enDevis($this, $this->scene, 20000, ['priority' => 'urgent', 'estimated_amount' => null]);
    $avec = C::enDevis($this, $this->scene, 20000, ['priority' => 'urgent']);

    $this->postJson(C::url($this->scene['org'], "/interventions/{$sans}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$avec}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk();

    $courriels = Mail::queued(ApprovalNoticeMail::class);
    expect($courriels)->toHaveCount(2);
    $courriels->first()->assertDontSeeInText('Montant')->assertDontSeeInText('0,00')->assertSeeInText('sans attendre votre accord');
    $courriels->last()->assertSeeInText('Montant : 200,00');
});

it('sans estimation, la dérogation d\'urgence couvre au plus le plafond d\'urgence', function (): void {
    $id = C::enDevis($this, $this->scene, 20000, ['priority' => 'urgent', 'estimated_amount' => null]);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk();

    $dans = (string) C::devis($this, $this->scene, $id, 100000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$dans}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$dans}/accept"))->assertOk();

    $hors = (string) C::devis($this, $this->scene, $id, 80000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$hors}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$hors}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
});
