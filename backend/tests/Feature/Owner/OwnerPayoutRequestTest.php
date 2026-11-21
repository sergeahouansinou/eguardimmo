<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use App\Modules\Parties\Enums\BankAccountStatus;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    $this->acces = P::acces($this->awa);
    $this->raison = fn (): ?ExclusionReason => L::dans($this->org, fn () => app(PayoutEvaluator::class)->evaluate($this->mandant->id, CarbonImmutable::today())->reason);
});

it('affiche le compte actuel sans jamais renvoyer l\'IBAN', function (): void {
    $reponse = O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->assertOk();

    expect($reponse->json('data.0'))->toMatchArray(['access_id' => $this->acces, 'role' => 'holder', 'can_request' => true, 'contested' => false, 'request' => null])
        ->and($reponse->json('data.0.current.bank_last4'))->toBe('4321')
        ->and($reponse->getContent())->not->toContain('FR76')->not->toContain('iban');
});

it('parcours nominal : demande, code, validation de l\'agence, activation et carence', function (): void {
    $avant = ($this->raison)();

    $demande = P::demander($this, $this->awa, $this->acces)->assertCreated();
    expect($demande->json('data'))->toMatchArray(['status' => 'awaiting_code', 'bank_last4' => '0189', 'holder_name' => 'Awa Diallo', 'access_id' => $this->acces])
        ->and($demande->getContent())->not->toContain(P::IBAN)
        ->and(strlen(P::code($this->awa)))->toBe(6)
        ->and(BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->where('status', 'pending')->count())->toBe(1);
    $id = $demande->json('data.id');

    P::confirmer($this, $this->awa, $id)->assertOk()->assertJsonPath('data.status', 'pending');

    expect(($this->raison)())->toBe($avant);

    $liste = O::comme($this, L::titulaire($this->org))->getJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests")->assertOk();
    expect($liste->json('data.0'))->toMatchArray(['id' => $id, 'status' => 'pending', 'bank_last4' => '0189'])->and($liste->getContent())->not->toContain(P::IBAN);

    P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk()->assertJsonPath('data.status', 'approved');

    $comptes = BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->orderBy('created_at')->get();
    expect($comptes)->toHaveCount(2)
        ->and($comptes[0]->valid_to?->toDateString())->toBe(now()->toDateString())
        ->and($comptes[1]->status)->toBe(BankAccountStatus::Active)->and($comptes[1]->activated_at)->not->toBeNull()
        ->and(L::dans($this->org, fn () => app(PartyDirectory::class)->payoutAccount($this->mandant->id)?->last4))->toBe('0189')
        ->and(($this->raison)())->toBe(ExclusionReason::AccountRecentlyChanged);

    $this->travelTo(now()->addDays(3));
    expect(($this->raison)())->not->toBe(ExclusionReason::AccountRecentlyChanged);

    $actions = AuditLog::query()->where('action', 'like', 'ownerfunds.payout_account.%')->pluck('action')->all();
    expect($actions)->toContain('ownerfunds.payout_account.requested', 'ownerfunds.payout_account.confirmed', 'ownerfunds.payout_account.approved')
        ->and(json_encode(AuditLog::query()->get()->map->metadata->all()))->not->toContain('FR76');
});

it('le mandant lit sa demande puis son nouveau compte actif', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    P::confirmer($this, $this->awa, $id)->assertOk();
    P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk();

    $ligne = O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->assertOk()->json('data.0');

    expect($ligne['current']['bank_last4'])->toBe('0189')->and($ligne['request']['status'])->toBe('approved')->and($ligne['cooling_until'])->not->toBeNull();
});

it('le refus garde la trace, laisse l\'ancien compte et ne revient pas sur le mandant', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    P::confirmer($this, $this->awa, $id)->assertOk();

    P::trancher($this, $this->org, $id, 'reject', ['lock_version' => P::version($id), 'reason' => 'Pièce illisible'])->assertOk()->assertJsonPath('data.status', 'rejected');

    $comptes = BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->get();
    expect($comptes->where('status', BankAccountStatus::Rejected))->toHaveCount(1)->and($comptes->where('status', BankAccountStatus::Active))->toHaveCount(1)
        ->and(O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->assertOk()->json('data.0.current.bank_last4'))->toBe('4321')
        ->and(O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->getContent())->not->toContain('Pièce illisible');
    P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_BIS])->assertCreated();
});

it('le mandant retire sa demande en cours', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');

    O::comme($this, $this->awa)->deleteJson("/api/v1/owner/payout-account/requests/{$id}", [], O::ORIGINE)->assertOk()->assertJsonPath('data.status', 'withdrawn');

    expect(BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->where('status', 'rejected')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.withdrawn')->count())->toBe(1);
    O::comme($this, $this->awa)->deleteJson("/api/v1/owner/payout-account/requests/{$id}", [], O::ORIGINE)->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
});

it('la contestation pose une retenue pleine, abandonne la demande vivante et se rejoue sans doublon', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    P::confirmer($this, $this->awa, $id)->assertOk();

    $contester = fn () => O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE);
    $contester()->assertOk()->assertJsonPath('data.contested', true);
    $contester()->assertOk();

    $retenues = L::dans($this->org, fn () => PayoutHold::query()->where('reason', HoldReason::AccountChangeContested->value)->get());
    expect($retenues)->toHaveCount(1)->and($retenues[0]->kind->value)->toBe('full')->and($retenues[0]->released_at)->toBeNull()
        ->and(PayoutAccountRequest::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('rejected')
        ->and(($this->raison)())->toBe(ExclusionReason::ActiveHold)
        ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.contested')->count())->toBe(1);
    expect(O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->json('data.0.contested'))->toBeTrue();
});
