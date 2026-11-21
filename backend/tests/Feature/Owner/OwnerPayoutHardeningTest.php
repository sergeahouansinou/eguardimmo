<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\OwnerAccess;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    $this->acces = P::acces($this->awa);
    $this->etat = fn (string $id): string => PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($id)->status->value;
    $this->comptes = fn (string $statut): int => BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->where('status', $statut)->count();
    $this->enAttente = function (): string {
        $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
        P::confirmer($this, $this->awa, $id)->assertOk();

        return $id;
    };
    $this->membre = fn ($compte, MemberRole $role = MemberRole::Accountant) => L::dans($this->org, fn (): OrganizationMember => OrganizationMember::query()->create([
        'user_id' => $compte->id, 'email' => mb_strtolower($compte->email), 'first_name' => 'Awa', 'last_name' => 'Diallo',
        'role' => $role, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
});

describe('séparation des tâches', function (): void {
    it('409 payout_account_self_approval quand l\'approbateur est le demandeur, rien n\'est activé', function (): void {
        $id = ($this->enAttente)();
        activerDeuxFacteurs($this->awa);
        ($this->membre)($this->awa);

        O::comme($this, $this->awa)->postJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests/{$id}/approve", P::approbation($id))
            ->assertStatus(409)->assertJsonPath('code', 'payout_account_self_approval');

        expect(($this->etat)($id))->toBe('pending')->and(($this->comptes)('active'))->toBe(1)->and(($this->comptes)('pending'))->toBe(1)
            ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.approved')->count())->toBe(0);
    });

    it('409 aussi pour un agent qui détient un autre accès vivant au même mandant', function (): void {
        $id = ($this->enAttente)();
        $agent = L::titulaire($this->org);
        O::acces($this->org, $this->mandant, $agent);

        P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertStatus(409)->assertJsonPath('code', 'payout_account_self_approval');

        expect(($this->etat)($id))->toBe('pending')->and(($this->comptes)('active'))->toBe(1);
    });

    it('un accès révoqué ou celui d\'un autre mandant ne bloque pas l\'agent', function (): void {
        $id = ($this->enAttente)();
        $agent = L::titulaire($this->org);
        $ancien = O::acces($this->org, $this->mandant, $agent);
        L::dans($this->org, fn () => $ancien->forceFill(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization'])->save());
        $autre = O::mandant($this->org, 'autre@exemple.fr');
        O::acces($this->org, $autre, $agent);

        P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk();

        expect(($this->etat)($id))->toBe('approved');
    });
});

describe('contestation en cours', function (): void {
    it('409 payout_account_contested tant que la retenue n\'est pas levée, puis la demande repart', function (): void {
        $id = ($this->enAttente)();
        O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();
        $avant = ($this->comptes)('pending');

        P::demander($this, $this->awa, $this->acces)->assertStatus(409)->assertJsonPath('code', 'payout_account_contested');
        expect(($this->comptes)('pending'))->toBe($avant)->and(PayoutAccountRequest::query()->withoutGlobalScopes()->count())->toBe(1);

        $retenue = L::dans($this->org, fn () => PayoutHold::query()->where('reason', HoldReason::AccountChangeContested->value)->whereNull('released_at')->firstOrFail());
        O::comme($this, L::titulaire($this->org))->postJson("/api/v1/org/{$this->org->id}/owner-funds/holds/{$retenue->id}/release")->assertOk();

        P::demander($this, $this->awa, $this->acces)->assertCreated();
        expect(($this->etat)($id))->toBe('rejected');
    });

    it('une retenue d\'un autre motif ne bloque pas la demande', function (): void {
        L::dans($this->org, fn () => PayoutHold::query()->create([
            'mandant_party_id' => $this->mandant->id, 'kind' => 'full', 'currency' => 'EUR', 'reason' => HoldReason::Dispute->value,
        ]));

        P::demander($this, $this->awa, $this->acces)->assertCreated();
    });
});

describe('accès du demandeur révoqué avant la validation', function (): void {
    it('409 payout_account_access_revoked, demande abandonnée et compte en attente rejeté (committés)', function (): void {
        $id = ($this->enAttente)();
        DB::table('owner_accesses')->where('id', $this->acces)->update(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization']);

        P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertStatus(409)->assertJsonPath('code', 'payout_account_access_revoked');

        $demande = PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($id);
        expect($demande->status->value)->toBe('withdrawn')->and($demande->reject_reason)->toBe('access_revoked')->and(($this->comptes)('active'))->toBe(1)
            ->and(($this->comptes)('pending'))->toBe(0)->and(($this->comptes)('rejected'))->toBe(1)
            ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.withdrawn')->count())->toBe(1);
    });

    it('la révocation par l\'agence abandonne la demande avant toute validation', function (): void {
        $id = ($this->enAttente)();

        O::comme($this, L::titulaire($this->org))->deleteJson("/api/v1/org/{$this->org->id}/parties/{$this->mandant->id}/owner-access/{$this->acces}")->assertSuccessful();

        expect(($this->etat)($id))->toBe('withdrawn')->and(OwnerAccess::query()->withoutGlobalScopes()->find($this->acces)->status->value)->toBe('revoked');
        P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
    });
});

describe('refus et concurrence', function (): void {
    it('404 pour le refus d\'une demande d\'une autre organisation, sans la toucher', function (): void {
        $id = ($this->enAttente)();
        $autre = L::organisation();
        $this->actingAs(F::comptable($autre));

        $this->postJson("/api/v1/org/{$autre->id}/owner-funds/payout-account-requests/{$id}/reject", ['lock_version' => P::version($id), 'reason' => 'x'])->assertNotFound();

        expect(($this->etat)($id))->toBe('pending')->and(($this->comptes)('pending'))->toBe(1);
    });

    it('une approbation concurrente validée entre la lecture et le verrou est refusée, jamais activée deux fois', function (): void {
        $id = ($this->enAttente)();
        $corps = P::approbation($id);
        $lectures = 0;
        Event::listen('eloquent.retrieved: '.PayoutAccountRequest::class, function () use (&$lectures, $id): void {
            if (++$lectures === 1) {
                DB::table('payout_account_requests')->where('id', $id)->update(['status' => 'approved', 'lock_version' => DB::raw('lock_version + 1')]);
            }
        });

        P::trancher($this, $this->org, $id, 'approve', $corps)->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');

        expect($lectures)->toBeGreaterThanOrEqual(2)->and(($this->comptes)('active'))->toBe(1)->and(($this->comptes)('pending'))->toBe(1)
            ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.approved')->count())->toBe(0);
    });

    it('le quatrième essai de code, même juste, est refusé : le compteur est celui de la base', function (): void {
        $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
        $bon = P::code($this->awa);
        $faux = $bon === '000000' ? '111111' : '000000';

        foreach (range(1, 3) as $essai) {
            P::confirmer($this, $this->awa, $id, $faux)->assertStatus(422);
        }
        P::confirmer($this, $this->awa, $id, $bon)->assertStatus(409);

        expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($id)->code_attempts)->toBe(3)->and(($this->etat)($id))->toBe('rejected');
    });
});
