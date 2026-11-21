<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

function demanderApport(object $test, array $corps = [], ?string $cle = null): TestResponse
{
    return F::envoyer($test, 'POST', F::url($test->org, '/trust/deposits'), ['amount' => 10000, 'executed_on' => now()->toDateString(), 'reference' => 'APP-001', ...$corps], $cle);
}

function confirmerApport(object $test, string $apport, ?string $cle = null): TestResponse
{
    return F::envoyer($test, 'POST', F::url($test->org, "/trust/deposits/{$apport}/confirm"), [], $cle);
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
});

it('un apport demandé n\'écrit rien au grand livre tant qu\'il n\'est pas confirmé ; en solo la même personne confirme', function (): void {
    $demande = demanderApport($this)->assertCreated();

    expect($demande->json('data.status'))->toBe('pending')->and($demande->json('data.bank_reference'))->toBe('APP-001')
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(0);

    $confirme = confirmerApport($this, $demande->json('data.id'))->assertOk();

    expect($confirme->json('data.status'))->toBe('confirmed')->and($confirme->json('data.confirmed_solo'))->toBeTrue()
        ->and($confirme->json('data.trust_transfer_id'))->not->toBeNull()
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(-10000);
});

it('la référence de rapprochement bancaire est obligatoire sur l\'apport', function (): void {
    F::envoyer($this, 'POST', F::url($this->org, '/trust/deposits'), ['amount' => 10000, 'executed_on' => now()->toDateString()])->assertStatus(422);
    F::envoyer($this, 'POST', F::url($this->org, '/trust/deposits'), ['amount' => 10000, 'executed_on' => now()->toDateString(), 'reference' => ''])->assertStatus(422);
});

it('double contrôle : le demandeur ne confirme pas son propre apport quand l\'équipe compte un second membre habilité', function (): void {
    F::comptable($this->org);
    $apport = demanderApport($this)->assertCreated()->json('data.id');

    confirmerApport($this, $apport)->assertForbidden()->assertJsonPath('code', 'payout_second_approver_required');
    expect(F::solde($this->org, AccountRole::TrustBank))->toBe(0);

    $this->actingAs(F::comptable($this->org));
    confirmerApport($this, $apport)->assertOk()->assertJsonPath('data.confirmed_solo', false);
    expect(F::solde($this->org, AccountRole::TrustBank))->toBe(-10000);
});

it('un apport confirmé ne se confirme pas deux fois : rejeu même clé idempotent, autre clé 409', function (): void {
    $apport = demanderApport($this)->assertCreated()->json('data.id');

    confirmerApport($this, $apport, 'confirmation-1')->assertOk();
    confirmerApport($this, $apport, 'confirmation-1')->assertOk();
    confirmerApport($this, $apport, 'confirmation-2')->assertStatus(409)->assertJsonPath('code', 'trust_deposit_not_actionable');

    expect(F::solde($this->org, AccountRole::TrustBank))->toBe(-10000);
});

it('même clé et contenu différent : 409 sur la demande d\'apport comme sur son retrait', function (): void {
    demanderApport($this, [], 'cle-apport')->assertCreated();
    demanderApport($this, ['amount' => 20000], 'cle-apport')->assertStatus(409)->assertJsonPath('code', 'owner_funds_idempotency_key_reused');
});

it('la liste des apports expose les demandes en attente et l\'apport d\'une autre organisation reste introuvable', function (): void {
    $apport = demanderApport($this)->assertCreated()->json('data.id');

    expect(collect($this->getJson(F::url($this->org, '/trust/deposits'))->assertOk()->json('data'))->pluck('id')->all())->toBe([$apport]);

    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    F::envoyer($this, 'POST', F::url($autre, "/trust/deposits/{$apport}/confirm"))->assertNotFound()->assertJsonPath('code', 'trust_deposit_not_found');
});
