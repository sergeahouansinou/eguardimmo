<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\Models\BankAccount;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    $this->acces = P::acces($this->awa);
    $this->demande = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    $this->actives = fn (): int => BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->where('status', 'active')->count();
});

it('refuse de valider une demande dont le code n\'est pas confirmé', function (): void {
    P::trancher($this, $this->org, $this->demande, 'approve', P::approbation($this->demande))->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
    P::trancher($this, $this->org, $this->demande, 'reject', ['lock_version' => 1, 'reason' => 'x'])->assertStatus(409);

    expect(($this->actives)())->toBe(1);
});

describe('demande confirmée', function (): void {
    beforeEach(function (): void {
        P::confirmer($this, $this->awa, $this->demande)->assertOk();
    });

    it('refuse un IBAN ressaisi différent de la demande, sans le révéler', function (): void {
        $r = P::trancher($this, $this->org, $this->demande, 'approve', P::approbation($this->demande, P::IBAN_BIS))->assertStatus(422);

        expect($r->json('code'))->toBe('payout_account_iban_mismatch')->and($r->getContent())->not->toContain(P::IBAN)->and(($this->actives)())->toBe(1);
    });

    it('refuse un titulaire différent de la demande', function (): void {
        P::trancher($this, $this->org, $this->demande, 'approve', P::approbation($this->demande, titulaire: 'Quelqu\'un d\'autre'))->assertStatus(422)->assertJsonPath('code', 'payout_account_holder_mismatch');

        expect(($this->actives)())->toBe(1);
    });

    it('accepte le titulaire avec une autre casse et des espaces en trop', function (): void {
        P::trancher($this, $this->org, $this->demande, 'approve', P::approbation($this->demande, 'fr76 3000 6000 0112 3456 7890 189', '  awa   DIALLO '))->assertOk();
    });

    it('refuse une version périmée de la demande', function (): void {
        $corps = P::approbation($this->demande);
        P::trancher($this, $this->org, $this->demande, 'approve', [...$corps, 'lock_version' => $corps['lock_version'] + 1])->assertStatus(409)->assertJsonPath('code', 'payout_account_request_stale');
        P::trancher($this, $this->org, $this->demande, 'reject', ['lock_version' => 99, 'reason' => 'x'])->assertStatus(409)->assertJsonPath('code', 'payout_account_request_stale');

        expect(($this->actives)())->toBe(1);
    });

    it('ne se valide qu\'une fois : le rejeu et la décision contraire sont refusés', function (): void {
        $corps = P::approbation($this->demande);
        P::trancher($this, $this->org, $this->demande, 'approve', $corps)->assertOk();

        P::trancher($this, $this->org, $this->demande, 'approve', P::approbation($this->demande))->assertStatus(409)->assertJsonPath('code', 'payout_account_request_not_actionable');
        P::trancher($this, $this->org, $this->demande, 'reject', ['lock_version' => P::version($this->demande), 'reason' => 'x'])->assertStatus(409);

        expect(($this->actives)())->toBe(2)->and(BankAccount::query()->withoutGlobalScopes()->where('party_id', $this->mandant->id)->whereNull('valid_to')->where('status', 'active')->count())->toBe(1);
    });

    it('404 pour une demande d\'une autre organisation', function (): void {
        $autre = L::organisation();
        $autreAgent = F::comptable($autre);
        $this->actingAs($autreAgent);

        $this->postJson("/api/v1/org/{$autre->id}/owner-funds/payout-account-requests/{$this->demande}/approve", P::approbation($this->demande))->assertNotFound();
        $this->getJson("/api/v1/org/{$autre->id}/owner-funds/payout-account-requests/{$this->demande}/proof")->assertNotFound();

        expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($this->demande)->status->value)->toBe('pending');
    });

    it('un comptable valide, un gestionnaire ne le peut pas', function (): void {
        $gestionnaire = L::membre($this->org, MemberRole::Manager);
        activerDeuxFacteurs($gestionnaire);
        $this->actingAs($gestionnaire);
        $this->postJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests/{$this->demande}/approve", P::approbation($this->demande))->assertForbidden();
        expect(PayoutAccountRequest::query()->withoutGlobalScopes()->find($this->demande)->status->value)->toBe('pending');

        O::comme($this, F::comptable($this->org));
        $this->postJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests/{$this->demande}/approve", P::approbation($this->demande))->assertOk();
    });

    it('sert la pièce justificative en privé à l\'agence, jamais au mandant', function (): void {
        O::comme($this, L::titulaire($this->org));
        $r = $this->get("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests/{$this->demande}/proof")->assertOk();

        expect($r->headers->get('Cache-Control'))->toContain('no-store')->and($r->headers->get('X-Content-Type-Options'))->toBe('nosniff');
    });

    it('liste les demandes par état, sans IBAN', function (): void {
        $liste = O::comme($this, L::titulaire($this->org))->getJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests?status=awaiting_code")->assertOk();
        $attente = O::comme($this, L::titulaire($this->org))->getJson("/api/v1/org/{$this->org->id}/owner-funds/payout-account-requests")->assertOk();

        expect($liste->json('data'))->toBe([])->and($attente->json('data'))->toHaveCount(1)->and($attente->getContent())->not->toContain(P::IBAN);
    });
});
