<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

/**
 * @param  array<string, mixed>  $scene
 * @return array{0: string, 1: string}
 */
function devisSoumis(object $test, array $scene, string $id, int $prix): array
{
    $devis = (string) C::devis($test, $scene, $id, $prix)->assertCreated()->json('data.id');
    $test->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();

    return [$devis, (string) InterventionApproval::query()->withoutGlobalScopes()->where('quote_id', $devis)->value('id')];
}

it('sous le plafond, l\'équipe accepte seule ; au-dessus, une demande d\'accord est ouverte et l\'acceptation refusée', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);

    [$devis, $demande] = devisSoumis($this, $scene, $id, 60000);

    expect($demande)->not->toBe('')
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->toBe('awaiting_approval');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
    $this->getJson(C::url($scene['org'], "/interventions/{$id}"))->assertOk()
        ->assertJsonPath('data.approvals.0.status', 'pending')->assertJsonPath('data.approvals.0.amount.amount', 72000)->assertJsonPath('data.approvals.0.ceiling_amount.amount', 50000);
});

it('le plafond se mesure sur le cumul TTC des devis acceptés, pas devis par devis', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 30000);

    $premier = (string) C::devis($this, $scene, $id, 30000)->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$premier}/submit"))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$premier}/accept"))->assertOk();
    expect(InterventionApproval::query()->withoutGlobalScopes()->count())->toBe(0);

    $second = (string) C::devis($this, $scene, $id, 30000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$second}/submit"))->assertOk();

    $demande = InterventionApproval::query()->withoutGlobalScopes()->firstOrFail();
    expect((int) $demande->amount->getAmount())->toBe(72000)
        ->and((int) $demande->ceiling_amount->getAmount())->toBe(50000);
});

it('la décision du mandant exige sa pièce écrite, accepte le devis et le rejeu ne change rien', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [$devis, $demande] = devisSoumis($this, $scene, $id, 60000);
    $url = C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/record-decision");

    $this->postJson($url, ['decision' => 'accept'])->assertUnprocessable()->assertJsonPath('code', 'approval_proof_required');
    $this->postJson($url, ['decision' => 'accept', 'proof_file_id' => C::fichier($this, $scene, $id, 'quote')])->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');

    $preuve = C::fichier($this, $scene, $id, 'proof');
    $this->postJson($url, ['decision' => 'accept', 'proof_file_id' => $preuve, 'comment' => 'Courriel du 18/11.'])->assertOk()
        ->assertJsonPath('data.status', 'accepted')->assertJsonPath('data.replayed', false)->assertJsonPath('data.decided_via', 'agency_recorded');
    $this->postJson($url, ['decision' => 'accept', 'proof_file_id' => $preuve])->assertOk()->assertJsonPath('data.replayed', true);
    $this->postJson($url, ['decision' => 'refuse', 'proof_file_id' => $preuve])->assertConflict()->assertJsonPath('code', 'approval_already_decided');

    $this->getJson(C::url($scene['org'], "/interventions/{$id}"))->assertOk()
        ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.approval_basis', 'owner_approved')
        ->assertJsonPath('data.quotes.0.status', 'accepted');
    expect(AuditLog::query()->where('action', 'maintenance.approval.recorded_for_owner')->count())->toBe(1);
});

it('un refus du mandant remet l\'intervention en consultation et refuse le devis', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [, $demande] = devisSoumis($this, $scene, $id, 60000);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/record-decision"), ['decision' => 'refuse', 'proof_file_id' => C::fichier($this, $scene, $id, 'proof')])
        ->assertOk()->assertJsonPath('data.status', 'refused');
    $this->getJson(C::url($scene['org'], "/interventions/{$id}"))->assertJsonPath('data.status', 'quoting')->assertJsonPath('data.quotes.0.status', 'refused');
});

it('le silence à l\'échéance n\'est jamais un accord : la demande expire sans approuver', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [$devis, $demande] = devisSoumis($this, $scene, $id, 60000);

    $this->travelTo(now()->addHours(49));
    $this->artisan('maintenance:expire-approvals')->assertSuccessful();

    expect(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($demande)->status->value)->toBe('expired')
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->toBe('quoting');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertConflict()->assertJsonPath('code', 'quote_status_invalid');
    $this->artisan('maintenance:expire-approvals')->assertSuccessful();
});

it('l\'urgence engage au-dessus du plafond seulement avec une priorité urgente et un motif, tracé dans le journal', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 90000);
    $url = C::url($scene['org'], "/interventions/{$id}/engage");

    $this->postJson($url, ['lock_version' => 3, 'basis' => 'under_ceiling'])->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
    $this->postJson($url, ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertUnprocessable()->assertJsonPath('code', 'intervention_emergency_not_allowed');
    $this->postJson($url, ['lock_version' => 3, 'basis' => 'owner_approved'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');

    $urgent = C::enDevis($this, $scene, 90000, ['priority' => 'urgent']);
    $this->postJson(C::url($scene['org'], "/interventions/{$urgent}/engage"), ['lock_version' => 3, 'basis' => 'emergency'])->assertUnprocessable()->assertJsonPath('code', 'intervention_emergency_not_allowed');
    $this->postJson(C::url($scene['org'], "/interventions/{$urgent}/engage"), ['lock_version' => 2, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertConflict()->assertJsonPath('code', 'intervention_stale_version');
    $this->postJson(C::url($scene['org'], "/interventions/{$urgent}/engage"), ['lock_version' => 3, 'basis' => 'emergency', 'reason' => 'Dégât des eaux en cours.'])->assertOk()
        ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.approval_basis', 'emergency')->assertJsonPath('data.emergency_reason', 'Dégât des eaux en cours.');

    expect(AuditLog::query()->where('action', 'maintenance.emergency.override')->count())->toBe(1);
});

it('un engagement sous le plafond sur l\'estimation passe sans accord', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 20000);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 3, 'basis' => 'under_ceiling'])->assertOk()
        ->assertJsonPath('data.approval_basis', 'under_ceiling');
});

it('une demande ouverte peut être retirée par l\'équipe ; une seule demande ouverte à la fois', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    $autre = (string) C::devis($this, $scene, $id, 70000)->assertCreated()->json('data.id');
    [, $demande] = devisSoumis($this, $scene, $id, 60000);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$autre}/submit"))->assertConflict()->assertJsonPath('code', 'approval_already_pending');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/withdraw"))->assertOk()->assertJsonPath('data.status', 'withdrawn');
});

it('une demande tranchée ne change plus et ne se supprime pas, même par écriture directe', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [, $demande] = devisSoumis($this, $scene, $id, 60000);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/record-decision"), ['decision' => 'accept', 'proof_file_id' => C::fichier($this, $scene, $id, 'proof')])->assertOk();

    expect(fn () => DB::table('intervention_approvals')->update(['status' => 'refused']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_approvals')->delete())->toThrow(QueryException::class);
});

it('un devis jamais soumis ne s\'accepte pas au-dessus du plafond : l\'accord du mandant reste exigé', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    $devis = (string) C::devis($this, $scene, $id, 60000)->assertCreated()->json('data.id');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertUnprocessable()->assertJsonPath('code', 'intervention_approval_required');
    expect(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->not->toBe('approved');
});

it('une demande retirée ne vaut pas accord', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [$devis, $demande] = devisSoumis($this, $scene, $id, 60000);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/withdraw"))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertStatus(409);
    expect(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->not->toBe('approved');
});

it('une décision reçue après l\'échéance expire la demande dans la même transaction et répond 409', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [, $demande] = devisSoumis($this, $scene, $id, 60000);
    $preuve = C::fichier($this, $scene, $id, 'proof');

    $this->travelTo(now()->addHours(49));
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/record-decision"), ['decision' => 'accept', 'proof_file_id' => $preuve])
        ->assertConflict()->assertJsonPath('code', 'approval_already_decided');

    expect(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($demande)->status->value)->toBe('expired')
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->toBe('quoting');
});

it('une pièce ne sert de preuve qu\'à une seule demande d\'accord', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [, $premiere] = devisSoumis($this, $scene, $id, 60000);
    $preuve = C::fichier($this, $scene, $id, 'proof');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$premiere}/record-decision"), ['decision' => 'refuse', 'proof_file_id' => $preuve])->assertOk();

    [, $seconde] = devisSoumis($this, $scene, $id, 70000);
    $url = C::url($scene['org'], "/interventions/{$id}/approvals/{$seconde}/record-decision");
    $this->postJson($url, ['decision' => 'accept', 'proof_file_id' => $preuve])->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');
    $this->postJson($url, ['decision' => 'accept', 'proof_file_id' => C::fichier($this, $scene, $id, 'proof')])->assertOk();
});

it('l\'annulation de la demande retire aussi l\'accord resté en question', function (): void {
    $scene = C::agence(50000);
    $id = C::enDevis($this, $scene, 60000);
    [, $demande] = devisSoumis($this, $scene, $id, 60000);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/approvals/{$demande}/record-decision"), ['decision' => 'question', 'comment' => 'Pourquoi ce prix ?', 'proof_file_id' => C::fichier($this, $scene, $id, 'proof')])->assertOk();
    expect(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($demande)->status->value)->toBe('question');

    $version = (int) Intervention::query()->withoutGlobalScopes()->findOrFail($id)->lock_version;
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/cancel"), ['lock_version' => $version])->assertOk();

    expect(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($demande)->status->value)->toBe('withdrawn');
});
