<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\ApprovalEvidence;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Maintenance\MaintenanceContext;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext;
use Tests\Feature\Owner\OwnerWriteContext as W;

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    [$this->id, $this->devis, $this->demande] = W::demande($this, $this->scene);
    $this->decider = fn (array $corps, ?string $cle = 'decision-cle-1', ?array $vue = null) => W::decider($this, $this->awa, $this->id, $this->demande, $corps, $cle, $vue);
    $this->etat = fn (): string => InterventionApproval::query()->withoutGlobalScopes()->findOrFail($this->demande)->status->value;
});

it('accepte le devis : décision du mandant, preuve figée, intervention engagée, audit sans montant', function (): void {
    $reponse = ($this->decider)(['decision' => 'accept'])->assertOk();

    $demande = InterventionApproval::query()->withoutGlobalScopes()->findOrFail($this->demande);
    $preuve = ApprovalEvidence::query()->withoutGlobalScopes()->sole();
    $audit = AuditLog::query()->where('action', 'maintenance.approval.decided')->sole();

    expect($reponse->json('data'))->toMatchArray(['id' => $this->demande, 'intervention_id' => $this->id, 'status' => 'accepted', 'decided_via' => 'owner_space', 'replayed' => false, 'lock_version' => 2])
        ->and($demande->decided_by_user_id)->toBe($this->awa->id)->and($demande->decider_party_id)->toBe($this->scene['mandant']->id)->and($demande->proof_file_id)->toBeNull()
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($this->id)->status->value)->toBe('approved')
        ->and(InterventionQuote::query()->withoutGlobalScopes()->findOrFail($this->devis)->status->value)->toBe('accepted')
        ->and($preuve->approval_id)->toBe($this->demande)->and($preuve->user_id)->toBe($this->awa->id)->and($preuve->mandant_party_id)->toBe($this->scene['mandant']->id)
        ->and($preuve->decision->value)->toBe('accept')->and($preuve->proof_method->value)->toBe('totp')->and($preuve->amount)->toBe(72000)->and($preuve->currency)->toBe('EUR')
        ->and($preuve->fingerprint)->toBe(hash('sha256', $preuve->payload))->and($preuve->statement_version)->toBe('v1')->and($preuve->idempotency_key)->toBe('decision-cle-1')
        ->and(json_decode($preuve->payload, true, 512, JSON_THROW_ON_ERROR))->toMatchArray(['approval' => $this->demande, 'decision' => 'accept', 'quote' => $this->devis, 'user' => $this->awa->id])
        ->and($audit->actor_user_id)->toBe($this->awa->id)->and($audit->metadata)->toMatchArray(['status' => 'accepted', 'decided_via' => 'owner_space', 'evidence_id' => $preuve->id])
        ->and(json_encode($audit->metadata, JSON_THROW_ON_ERROR))->not->toContain('72000');
});

it('refuse le devis avec un commentaire : le devis est refusé et l\'intervention retourne en devis', function (): void {
    ($this->decider)(['decision' => 'refuse', 'comment' => 'Trop cher pour cette réparation.'])->assertOk()->assertJsonPath('data.status', 'refused')->assertJsonPath('data.comment', 'Trop cher pour cette réparation.');

    expect(InterventionQuote::query()->withoutGlobalScopes()->findOrFail($this->devis)->status->value)->toBe('refused')
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($this->id)->status->value)->toBe('quoting')
        ->and(ApprovalEvidence::query()->withoutGlobalScopes()->sole()->decision->value)->toBe('refuse');
});

it('une demande de précision laisse la demande ouverte, puis le mandant peut encore accepter', function (): void {
    ($this->decider)(['decision' => 'question', 'comment' => 'Le devis comprend-il la dépose ?'], 'decision-cle-q')->assertOk()->assertJsonPath('data.status', 'question')->assertJsonPath('data.decided_at', null);
    expect(($this->etat)())->toBe('question');

    ($this->decider)(['decision' => 'accept'], 'decision-cle-a')->assertOk()->assertJsonPath('data.status', 'accepted');

    expect(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('exige un commentaire d\'au moins 5 caractères pour refuser ou demander une précision, et rejette les champs invalides', function (): void {
    foreach ([['decision' => 'refuse'], ['decision' => 'refuse', 'comment' => 'non'], ['decision' => 'question', 'comment' => '    ']] as $corps) {
        ($this->decider)($corps)->assertUnprocessable()->assertJsonValidationErrors(['comment']);
    }

    ($this->decider)(['decision' => 'maybe'])->assertUnprocessable()->assertJsonValidationErrors(['decision']);
    ($this->decider)(['decision' => 'accept', 'lock_version' => 'x', 'quote_fingerprint' => 'court', 'statement_version' => ''])->assertUnprocessable()->assertJsonValidationErrors(['lock_version', 'quote_fingerprint', 'statement_version']);
    expect(($this->etat)())->toBe('pending')->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('exige l\'en-tête Idempotency-Key', function (): void {
    ($this->decider)(['decision' => 'accept'], null)->assertUnprocessable()->assertJsonPath('code', 'idempotency_key_required');
    ($this->decider)(['decision' => 'accept'], 'court')->assertUnprocessable()->assertJsonPath('code', 'idempotency_key_required');

    expect(($this->etat)())->toBe('pending');
});

it('rejoue sans rien écrire : même clé, ou même décision avec une autre clé', function (): void {
    ($this->decider)(['decision' => 'accept'])->assertOk()->assertJsonPath('data.replayed', false);
    $vue = W::vue($this, $this->awa, $this->id);

    ($this->decider)(['decision' => 'accept'], 'decision-cle-1', $vue)->assertOk()->assertJsonPath('data.replayed', true)->assertJsonPath('data.status', 'accepted');
    ($this->decider)(['decision' => 'accept'], 'decision-cle-2', $vue)->assertOk()->assertJsonPath('data.replayed', true);

    expect(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'maintenance.approval.decided')->count())->toBe(1)
        ->and(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($this->demande)->lock_version)->toBe(2);
});

it('refuse la décision contraire sur une demande tranchée, et une clé réutilisée pour une autre décision', function (): void {
    ($this->decider)(['decision' => 'accept'])->assertOk();
    $vue = W::vue($this, $this->awa, $this->id);

    ($this->decider)(['decision' => 'refuse', 'comment' => 'Finalement non.'], 'decision-cle-2', $vue)->assertConflict()->assertJsonPath('code', 'approval_already_decided');
    ($this->decider)(['decision' => 'refuse', 'comment' => 'Finalement non.'], 'decision-cle-1', $vue)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');

    expect(($this->etat)())->toBe('accepted')->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('refuse une décision prise sur une vue périmée : version, empreinte du devis ou texte de mention, sans rien écrire', function (): void {
    $vue = W::vue($this, $this->awa, $this->id);

    foreach ([
        ['lock_version' => $vue['lock_version'] + 1],
        ['quote_fingerprint' => str_repeat('a', 64)],
        ['statement_version' => 'v0'],
    ] as $ecart) {
        ($this->decider)(['decision' => 'accept'], 'decision-cle-1', [...$vue, ...$ecart])->assertConflict()->assertJsonPath('code', 'approval_stale');
    }

    expect(($this->etat)())->toBe('pending')->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($this->id)->status->value)->toBe('awaiting_approval');
});

it('refuse une décision sur un devis modifié depuis son affichage', function (): void {
    $vue = W::vue($this, $this->awa, $this->id);
    InterventionApproval::query()->withoutGlobalScopes()->whereKey($this->demande)->update(['amount' => 99000]);

    ($this->decider)(['decision' => 'accept'], 'decision-cle-1', $vue)->assertConflict()->assertJsonPath('code', 'approval_stale');
    expect(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('une décision reçue après l\'échéance expire la demande et répond 409', function (): void {
    $vue = W::vue($this, $this->awa, $this->id);
    $this->travelTo(now()->addHours(49));

    ($this->decider)(['decision' => 'accept'], 'decision-cle-1', $vue)->assertConflict()->assertJsonPath('code', 'approval_already_decided');

    expect(($this->etat)())->toBe('expired')->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($this->id)->status->value)->toBe('quoting');
});

it('ignore tout champ que le client ne doit pas fixer', function (): void {
    ($this->decider)([
        'decision' => 'accept', 'organization_id' => fake()->uuid(), 'mandant_party_id' => fake()->uuid(), 'user_id' => fake()->uuid(), 'decided_via' => 'agency_recorded',
        'status' => 'refused', 'amount' => 1, 'decided_by_user_id' => fake()->uuid(), 'proof_file_id' => fake()->uuid(), 'access_id' => fake()->uuid(),
    ])->assertOk()->assertJsonPath('data.status', 'accepted')->assertJsonPath('data.decided_via', 'owner_space');

    $preuve = ApprovalEvidence::query()->withoutGlobalScopes()->sole();
    $demande = InterventionApproval::query()->withoutGlobalScopes()->findOrFail($this->demande);

    expect($preuve->organization_id)->toBe($this->org->id)->and($preuve->mandant_party_id)->toBe($this->scene['mandant']->id)->and($preuve->user_id)->toBe($this->awa->id)
        ->and((int) $demande->amount->getAmount())->toBe(72000)->and($demande->decided_by_user_id)->toBe($this->awa->id);
});

it('la preuve est en ajout seul : modification et suppression refusées par la base', function (): void {
    ($this->decider)(['decision' => 'accept'])->assertOk();
    $preuve = ApprovalEvidence::query()->withoutGlobalScopes()->sole();

    expect(fn () => ApprovalEvidence::query()->withoutGlobalScopes()->whereKey($preuve->id)->update(['decision' => 'refuse']))->toThrow(QueryException::class)
        ->and(fn () => ApprovalEvidence::query()->withoutGlobalScopes()->whereKey($preuve->id)->delete())->toThrow(QueryException::class)
        ->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('sert au mandant la version, l\'empreinte et le texte de mention à renvoyer, et rien d\'interne', function (): void {
    $a = OwnerReadContext::lire($this, $this->awa, '/interventions/'.$this->id)->assertOk()->json('data.approvals.0');

    expect($a)->toHaveKeys(['lock_version', 'quote_fingerprint', 'statement_version'])->and($a['quote_fingerprint'])->toMatch('/^[0-9a-f]{64}$/')->and($a['statement_version'])->toBe('v1');
    ($this->decider)(['decision' => 'accept'])->assertOk();
    expect(OwnerReadContext::lire($this, $this->awa, '/interventions/'.$this->id)->json('data.approvals.0.statement_version'))->toBeNull();
});

it('refuse un rejeu qui change le commentaire sous la même clé, sans toucher à la preuve', function (): void {
    ($this->decider)(['decision' => 'accept', 'comment' => 'Je valide.'])->assertOk();
    $vue = W::vue($this, $this->awa, $this->id);

    ($this->decider)(['decision' => 'accept', 'comment' => 'Je valide autrement.'], 'decision-cle-1', $vue)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    ($this->decider)(['decision' => 'accept'], 'decision-cle-1', $vue)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    ($this->decider)(['decision' => 'accept', 'comment' => 'Je valide.'], 'decision-cle-1', $vue)->assertOk()->assertJsonPath('data.replayed', true);

    expect(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and(json_decode(ApprovalEvidence::query()->withoutGlobalScopes()->sole()->payload, true, 512, JSON_THROW_ON_ERROR)['comment'])->toBe('Je valide.');
});

it('la même clé d\'idempotence dans deux organisations ne se heurte pas : deux décisions, deux preuves, jamais de 500', function (): void {
    $autre = MaintenanceContext::agence(50000);
    O::acces($autre['org'], $autre['mandant'], $this->awa);
    [$idB, , $demandeB] = W::demande($this, $autre);

    ($this->decider)(['decision' => 'accept'])->assertOk();
    W::decider($this, $this->awa, $idB, $demandeB, ['decision' => 'accept'], 'decision-cle-1')->assertOk()->assertJsonPath('data.replayed', false);

    expect(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(2)
        ->and(ApprovalEvidence::query()->withoutGlobalScopes()->distinct()->pluck('organization_id')->count())->toBe(2);
});

it('l\'index unique de la preuve porte l\'organisation : (organization_id, user_id, idempotency_key)', function (): void {
    $colonnes = collect(Schema::getIndexes('approval_evidences'))->first(fn (array $i): bool => $i['unique'] && in_array('idempotency_key', $i['columns'], true));

    expect($colonnes['columns'])->toBe(['organization_id', 'user_id', 'idempotency_key']);
});
