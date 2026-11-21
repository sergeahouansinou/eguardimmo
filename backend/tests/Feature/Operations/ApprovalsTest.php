<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Notifications\ApprovalPendingNotification;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Approval\ApprovalSubject;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Feature\Console\ConsoleContext as C;

beforeEach(function (): void {
    Notification::fake();
    config(['operations.team_address' => 'equipe@exemple.test']);
    $this->execute = new ArrayObject(['n' => 0, 'mode' => 'ok', 'cible' => null]);
    $execute = $this->execute;
    $this->sujet = (string) Str::uuid7();
    $this->victime = User::factory()->create(['name' => 'Nom intact']);

    $handlers = app(ApprovalHandlers::class);
    foreach (['organizations.suspend', 'privacy.erasure.execute', 'subscriptions.plan_version.publish'] as $action) {
        $handlers->register(
            $action,
            fn (string $id, array $charge): ApprovalSubject => new ApprovalSubject('stub', $id, null, array_intersect_key($charge, ['reason_code' => 1])),
            function (ApprovalExecution $e) use ($execute): void {
                $execute['n'] = $execute['n'] + 1;
                $execute['cible'] = $e;
                User::query()->whereKey($execute['victime'] ?? null)->update(['name' => 'Nom modifié']);
                if ($execute['mode'] === 'stale') {
                    throw new ApprovalStale;
                }
                if ($execute['mode'] === 'crash') {
                    throw new RuntimeException('panne');
                }
            },
        );
    }
    $this->execute['victime'] = $this->victime->id;

    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->admin2 = C::operateur(['admin'], 'Alain Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->billing = C::operateur(['billing'], 'Bill Billing');

    $this->demander = function (array $op, array $corps = []) {
        return C::ecrire($this, $op['jeton'], 'POST', '/api/v1/console/approvals', [
            'action' => 'organizations.suspend', 'subject_id' => $this->sujet, 'reason' => 'Fraude avérée sur plusieurs encaissements', ...$corps,
        ]);
    };
    $this->agir = fn (array $op, string $id, string $verbe) => C::ecrire($this, $op['jeton'], 'POST', "/api/v1/console/approvals/{$id}/{$verbe}");
});

it('dépose une demande, journalise sans motif et prévient la boîte d\'équipe sans contenu', function (): void {
    $reponse = ($this->demander)($this->support, ['ticket_reference' => 'SUP-2026-00012', 'payload' => ['reason_code' => 'fraud', 'inconnu' => 'x']])->assertCreated();

    $reponse->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.action', 'organizations.suspend')
        ->assertJsonPath('data.requested_by.name', 'Sam Support')
        ->assertJsonPath('data.requested_proof', 'totp')
        ->assertJsonPath('data.permissions.can_cancel', true)
        ->assertJsonPath('data.permissions.can_decide', false)
        ->assertJsonPath('data.payload', ['reason_code' => 'fraud']);

    $audit = AuditLog::query()->where('action', 'operations.approval.requested')->firstOrFail();
    expect(json_encode($audit->metadata))->not->toContain('Fraude avérée')
        ->and($audit->metadata)->toMatchArray(['approval_action' => 'organizations.suspend', 'ticket_reference' => 'SUP-2026-00012'])
        ->and(OperatorApproval::query()->firstOrFail()->reason)->toBe('Fraude avérée sur plusieurs encaissements')
        ->and((string) DB::table('operator_approvals')->value('reason'))->not->toContain('Fraude');
    Notification::assertSentOnDemand(ApprovalPendingNotification::class);
});

it('n\'accepte du client ni statut, ni organisation, ni demandeur, ni échéance', function (): void {
    $reponse = ($this->demander)($this->support, ['status' => 'approved', 'organization_id' => (string) Str::uuid7(), 'requested_by_user_id' => $this->admin['user']->id, 'expires_at' => '2099-01-01'])->assertCreated();

    $demande = OperatorApproval::query()->findOrFail($reponse->json('data.id'));
    expect($demande->status->value)->toBe('pending')
        ->and($demande->organization_id)->toBeNull()
        ->and($demande->requested_by_user_id)->toBe($this->support['user']->id)
        ->and($demande->expires_at->isBefore(now()->addHours(25)))->toBeTrue();
});

it('valide la demande : motif trop court, action inconnue ou sujet invalide', function (): void {
    ($this->demander)($this->support, ['reason' => 'court'])->assertUnprocessable()->assertJsonValidationErrors('reason');
    ($this->demander)($this->support, ['action' => 'organizations.delete'])->assertUnprocessable()->assertJsonValidationErrors('action');
    ($this->demander)($this->support, ['subject_id' => 'pas-un-uuid'])->assertUnprocessable()->assertJsonValidationErrors('subject_id');
    expect(OperatorApproval::query()->count())->toBe(0);
});

it('réserve la demande aux rôles habilités de l\'action', function (): void {
    ($this->demander)($this->billing)->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    ($this->demander)($this->conformite)->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    ($this->demander)($this->billing, ['action' => 'subscriptions.plan_version.publish'])->assertCreated();
    ($this->demander)($this->support, ['action' => 'subscriptions.plan_version.publish'])->assertForbidden();
    ($this->demander)($this->admin, ['action' => 'privacy.erasure.execute'])->assertForbidden();
});

it('refuse une seconde demande vivante pour la même action et le même sujet, puis l\'accepte après expiration', function (): void {
    ($this->demander)($this->support)->assertCreated();
    ($this->demander)($this->admin)->assertConflict()->assertJsonPath('code', 'approval_pending_exists');

    $this->travel(25)->hours();
    ($this->demander)($this->admin)->assertCreated();

    expect(OperatorApproval::query()->where('status', 'expired')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'operations.approval.expired')->count())->toBe(1);
});

it('valide et exécute à la validation par un autre opérateur habilité, en une seule fois', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');

    ($this->agir)($this->conformite, $id, 'approve')->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.decided_by.name', 'Clara Conformité')
        ->assertJsonPath('data.decided_proof', 'totp');

    expect($this->execute['n'])->toBe(1)
        ->and($this->execute['cible']->decidedByUserId)->toBe($this->conformite['user']->id)
        ->and($this->execute['cible']->requestedByUserId)->toBe($this->support['user']->id)
        ->and(OperatorApproval::query()->findOrFail($id)->executed_at)->not->toBeNull()
        ->and(AuditLog::query()->whereIn('action', ['operations.approval.approved', 'operations.approval.executed'])->count())->toBe(2);
});

it('refuse qu\'un opérateur valide sa propre demande, même administrateur', function (): void {
    $id = ($this->demander)($this->admin)->json('data.id');

    ($this->agir)($this->admin, $id, 'approve')->assertForbidden()->assertJsonPath('code', 'approval_self_forbidden');
    ($this->agir)($this->admin, $id, 'reject')->assertForbidden()->assertJsonPath('code', 'approval_self_forbidden');

    expect($this->execute['n'])->toBe(0)->and(OperatorApproval::query()->findOrFail($id)->status->value)->toBe('pending');
});

it('refuse la validation à un rôle non habilité', function (): void {
    $id = ($this->demander)($this->admin)->json('data.id');

    ($this->agir)($this->support, $id, 'approve')->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    ($this->agir)($this->billing, $id, 'approve')->assertNotFound();

    expect($this->execute['n'])->toBe(0);
});

it('rejoue la validation du même opérateur sans réexécuter, et refuse un autre opérateur', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');

    ($this->agir)($this->admin, $id, 'approve')->assertOk();
    ($this->agir)($this->admin, $id, 'approve')->assertOk()->assertJsonPath('data.status', 'approved');
    ($this->agir)($this->admin2, $id, 'approve')->assertConflict()->assertJsonPath('code', 'approval_not_pending');
    ($this->agir)($this->admin, $id, 'reject')->assertConflict()->assertJsonPath('code', 'approval_not_pending');

    expect($this->execute['n'])->toBe(1);
});

it('refuse une demande expirée : 409 approval_expired, statut expiré, rien d\'exécuté', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');
    $this->travel(25)->hours();

    ($this->agir)($this->admin, $id, 'approve')->assertConflict()->assertJsonPath('code', 'approval_expired');
    ($this->agir)($this->admin, $id, 'approve')->assertConflict()->assertJsonPath('code', 'approval_expired');

    expect($this->execute['n'])->toBe(0)
        ->and(OperatorApproval::query()->findOrFail($id)->status->value)->toBe('expired')
        ->and(AuditLog::query()->where('action', 'operations.approval.expired')->count())->toBe(1);
});

it('passe en échec sans rien écrire quand l\'état a changé entre la demande et la validation', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');
    $this->execute['mode'] = 'stale';

    ($this->agir)($this->admin, $id, 'approve')->assertConflict()->assertJsonPath('code', 'approval_stale');

    $demande = OperatorApproval::query()->findOrFail($id);
    expect($demande->status->value)->toBe('failed')
        ->and($demande->failure_code)->toBe('approval_stale')
        ->and($demande->executed_at)->toBeNull()
        ->and($this->victime->refresh()->name)->toBe('Nom intact')
        ->and(AuditLog::query()->where('action', 'operations.approval.failed')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'operations.approval.executed')->count())->toBe(0);

    ($this->demander)($this->support)->assertCreated();
});

it('ne laisse rien de partiel quand l\'exécuteur plante : la demande reste en attente', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');
    $this->execute['mode'] = 'crash';

    ($this->agir)($this->admin, $id, 'approve')->assertStatus(500);

    expect(OperatorApproval::query()->findOrFail($id)->status->value)->toBe('pending')
        ->and($this->victime->refresh()->name)->toBe('Nom intact')
        ->and(AuditLog::query()->whereIn('action', ['operations.approval.approved', 'operations.approval.executed'])->count())->toBe(0);
});

it('rejette une demande, et le demandeur seul peut l\'annuler', function (): void {
    $a = ($this->demander)($this->support)->json('data.id');
    ($this->agir)($this->admin, $a, 'reject')->assertOk()->assertJsonPath('data.status', 'rejected');
    ($this->agir)($this->admin, $a, 'reject')->assertOk();

    $b = ($this->demander)($this->support)->json('data.id');
    ($this->agir)($this->admin, $b, 'cancel')->assertForbidden()->assertJsonPath('code', 'approval_role_forbidden');
    ($this->agir)($this->support, $b, 'cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
    ($this->agir)($this->support, $b, 'cancel')->assertOk();
    ($this->agir)($this->admin, $b, 'approve')->assertConflict()->assertJsonPath('code', 'approval_not_pending');

    expect($this->execute['n'])->toBe(0);
});

it('enregistre la preuve par code de secours', function (): void {
    $reponse = C::ecrireBrut($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'recovery_code' => 'code-secours-1', 'action' => 'organizations.suspend', 'subject_id' => $this->sujet, 'reason' => 'Fraude avérée sur plusieurs encaissements',
    ])->assertCreated();

    $reponse->assertJsonPath('data.requested_proof', 'recovery_code');
});

it('ne montre une demande qu\'aux rôles qui peuvent la demander ou la valider', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');

    C::lire($this, $this->billing['jeton'], "/api/v1/console/approvals/{$id}")->assertNotFound()->assertJsonPath('code', 'approval_not_found');
    expect(C::lire($this, $this->billing['jeton'], '/api/v1/console/approvals')->assertOk()->json('data'))->toBe([]);
    C::lire($this, $this->conformite['jeton'], "/api/v1/console/approvals/{$id}")->assertOk()->assertJsonPath('data.permissions.can_decide', true);
    C::lire($this, $this->admin['jeton'], '/api/v1/console/approvals/'.C::UUID_INCONNU)->assertNotFound();
});

it('liste par curseur avec le compteur d\'attente, à nombre de requêtes constant', function (): void {
    foreach (range(1, 12) as $i) {
        ($this->demander)($this->support, ['subject_id' => (string) Str::uuid7()])->assertCreated();
    }

    $nombre = function (int $parPage): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        C::lire($this, $this->admin['jeton'], "/api/v1/console/approvals?per_page={$parPage}")->assertOk();

        return count(DB::getQueryLog());
    };

    $page = C::lire($this, $this->admin['jeton'], '/api/v1/console/approvals?status=pending&per_page=5')->assertOk();
    expect($page->json('data'))->toHaveCount(5)
        ->and($page->json('meta.pending_count'))->toBe(12)
        ->and($page->json('meta.has_more'))->toBeTrue();

    $suite = C::lire($this, $this->admin['jeton'], '/api/v1/console/approvals?status=pending&per_page=5&cursor='.$page->json('meta.next_cursor'))->assertOk();
    expect($suite->json('data'))->toHaveCount(5)->and(array_intersect(array_column($page->json('data'), 'id'), array_column($suite->json('data'), 'id')))->toBe([]);
    expect($nombre(1))->toBe($nombre(12));
    C::lire($this, $this->admin['jeton'], '/api/v1/console/approvals?cursor=n-importe-quoi')->assertUnprocessable();
});

it('expire les demandes échues par la commande horaire, journalisée', function (): void {
    ($this->demander)($this->support)->assertCreated();
    $this->travel(25)->hours();

    $this->artisan('operations:expire-approvals')->assertSuccessful();

    expect(OperatorApproval::query()->where('status', 'expired')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'operations.approval.expired')->count())->toBe(1);
});

it('exécute une demande depuis le serveur pour une équipe d\'un seul opérateur, journalisée via artisan', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');

    $this->artisan('operations:execute-approval', ['id' => $id])
        ->expectsConfirmation("Valider et exécuter la demande organizations.suspend ({$id}) déposée par Sam Support ?", 'no')
        ->assertFailed();
    expect($this->execute['n'])->toBe(0);

    $this->artisan('operations:execute-approval', ['id' => $id])
        ->expectsConfirmation("Valider et exécuter la demande organizations.suspend ({$id}) déposée par Sam Support ?", 'yes')
        ->assertSuccessful();

    $demande = OperatorApproval::query()->findOrFail($id);
    expect($demande->status->value)->toBe('approved')->and($demande->decided_proof)->toBe('artisan')->and($demande->decided_by_user_id)->toBeNull()
        ->and(AuditLog::query()->where('action', 'operations.approval.approved')->firstOrFail()->metadata)->toMatchArray(['via' => 'artisan', 'host' => (string) gethostname()])
        ->and($this->execute['n'])->toBe(1);
    $this->artisan('operations:execute-approval', ['id' => $id])->expectsConfirmation("Valider et exécuter la demande organizations.suspend ({$id}) déposée par Sam Support ?", 'yes')->assertFailed();
    $this->artisan('operations:execute-approval', ['id' => 'inconnu'])->assertFailed();
});

it('protège la demande en base : décision finale, champs figés, aucune suppression', function (): void {
    $id = ($this->demander)($this->support)->json('data.id');
    ($this->agir)($this->admin, $id, 'approve')->assertOk();

    expect(fn () => DB::table('operator_approvals')->where('id', $id)->update(['status' => 'pending']))->toThrow(Exception::class);
    expect(fn () => DB::table('operator_approvals')->where('id', $id)->update(['action' => 'privacy.erasure.execute']))->toThrow(Exception::class);
    expect(fn () => DB::table('operator_approvals')->where('id', $id)->update(['decided_by_user_id' => $this->support['user']->id]))->toThrow(Exception::class);
    expect(fn () => DB::table('operator_approvals')->where('id', $id)->delete())->toThrow(Exception::class);
});

it('tient la demande vivante unique en base, pas seulement dans le code', function (): void {
    ($this->demander)($this->support)->assertCreated();
    $demande = OperatorApproval::query()->firstOrFail();

    $copie = DB::table('operator_approvals')->where('id', $demande->id)->first();
    $ligne = collect((array) $copie)->except('live_key')->all();
    $ligne['id'] = (string) Str::uuid7();

    expect(fn () => DB::table('operator_approvals')->insert($ligne))->toThrow(UniqueConstraintViolationException::class);
});
