<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Notifications\PayoutAccountCodeNotification;
use App\Modules\Parties\Models\BankAccount;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    $this->acces = P::acces($this->awa);
    $this->demande = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    $this->etat = fn (): string => PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($this->demande)->status->value;
    $this->faux = fn (): string => P::code($this->awa) === '000000' ? '111111' : '000000';
});

it('envoie le code à l\'adresse du compte, sans IBAN, et ne le stocke qu\'haché', function (): void {
    Notification::assertSentTo($this->awa, PayoutAccountCodeNotification::class, function (PayoutAccountCodeNotification $n): bool {
        $texte = implode(' ', $n->toMail($this->awa)->introLines);

        return preg_match('/^\d{6}$/', $n->code) === 1 && ! str_contains($texte, 'FR76') && ! str_contains($texte, '0189');
    });
    $hash = PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($this->demande)->code_hash;

    expect($hash)->not->toBeNull()->and($hash)->not->toContain(P::code($this->awa));
});

it('un code faux est refusé en 422, compte un essai et n\'active rien', function (): void {
    P::confirmer($this, $this->awa, $this->demande, ($this->faux)())->assertStatus(422)->assertJsonPath('code', 'payout_account_code_invalid');

    expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($this->demande)->code_attempts)->toBe(1)->and(($this->etat)())->toBe('awaiting_code')
        ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.code_failed')->count())->toBe(1);
    P::confirmer($this, $this->awa, $this->demande)->assertOk();
});

it('après trois essais, la demande est refusée et le bon code ne sert plus', function (): void {
    foreach (range(1, 3) as $essai) {
        P::confirmer($this, $this->awa, $this->demande, ($this->faux)())->assertStatus(422);
    }

    expect(($this->etat)())->toBe('rejected')->and(BankAccount::query()->withoutGlobalScopes()->where('status', 'rejected')->count())->toBe(1);
    P::confirmer($this, $this->awa, $this->demande)->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
    P::demander($this, $this->awa, $this->acces)->assertCreated();
});

it('un code périmé est refusé et la demande expire', function (): void {
    $code = P::code($this->awa);
    $this->travelTo(now()->addMinutes(16));

    P::confirmer($this, $this->awa, $this->demande, $code)->assertStatus(422)->assertJsonPath('code', 'payout_account_code_invalid');

    expect(($this->etat)())->toBe('expired')->and(BankAccount::query()->withoutGlobalScopes()->where('status', 'rejected')->count())->toBe(1);
});

it('la confirmation ne se rejoue pas', function (): void {
    $code = P::code($this->awa);
    P::confirmer($this, $this->awa, $this->demande, $code)->assertOk();

    P::confirmer($this, $this->awa, $this->demande, $code)->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
    expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($this->demande)->code_hash)->toBeNull();
});

it('un autre compte du même mandant ne confirme pas la demande d\'autrui', function (): void {
    $rep = User::factory()->create(['email' => 'rep@exemple.fr']);
    O::acces($this->org, $this->mandant, $rep);
    activerDeuxFacteurs($rep);

    P::confirmer($this, $rep, $this->demande, P::code($this->awa))->assertNotFound()->assertJsonPath('code', 'payout_account_request_not_found');

    expect(($this->etat)())->toBe('awaiting_code');
});

it('refuse un code mal formé', function (): void {
    foreach (['12345', '1234567', 'abcdef', '', null] as $code) {
        O::comme($this, $this->awa)->postJson("/api/v1/owner/payout-account/requests/{$this->demande}/confirm", ['code' => $code], O::ORIGINE)->assertStatus(422);
    }

    expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($this->demande)->code_attempts)->toBe(0);
});

it('la commande d\'expiration clôt les codes périmés et les demandes sans suite après 14 jours, pas les autres', function (): void {
    $enAttente = P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_BIS])->assertStatus(409);
    P::confirmer($this, $this->awa, $this->demande)->assertOk();

    $this->travelTo(now()->addDays(13));
    Artisan::call('ownerfunds:expire-payout-requests');
    expect(($this->etat)())->toBe('pending');

    $this->travelTo(now()->addDays(2));
    expect(Artisan::call('ownerfunds:expire-payout-requests'))->toBe(0)->and(($this->etat)())->toBe('expired')
        ->and(BankAccount::query()->withoutGlobalScopes()->where('status', 'rejected')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'ownerfunds.payout_account.expired')->count())->toBe(1);
    P::demander($this, $this->awa, $this->acces)->assertCreated();
    $this->travelTo(now()->addMinutes(20));
    Artisan::call('ownerfunds:expire-payout-requests');
    expect(PayoutAccountRequest::query()->withoutGlobalScopes()->where('status', 'expired')->count())->toBe(2);
});

it('la création d\'une nouvelle demande expire d\'abord le code périmé du mandant', function (): void {
    $this->travelTo(now()->addMinutes(20));

    P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_BIS])->assertCreated();

    expect(($this->etat)())->toBe('expired');
});
