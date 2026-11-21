<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    $this->creer = fn (?string $cle = null) => F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]], $cle);
});

it('422 sans en-tête Idempotency-Key sur une route qui écrit', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $this->postJson(F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertStatus(422)->assertJsonPath('code', 'owner_funds_idempotency_key_required');
});

it('rejoue le même lot sous la même clé (200, même identifiant) et refuse la clé réutilisée avec un autre contenu (409)', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $premier = ($this->creer)('lot-rejeu-1')->assertCreated();
    $rejeu = ($this->creer)('lot-rejeu-1')->assertOk();
    $autre = F::envoyer($this, 'POST', F::url($this->org, '/batches'), [], 'lot-rejeu-1');

    expect($rejeu->json('data.id'))->toBe($premier->json('data.id'))
        ->and($autre->status())->toBe(409)
        ->and($autre->json('code'))->toBe('owner_funds_idempotency_key_reused')
        ->and(L::dans($this->org, fn () => PayoutBatch::query()->count()))->toBe(1);
});

it('un mandant déjà dans un lot ouvert ne peut pas être repris dans un second lot', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    ($this->creer)()->assertCreated();

    ($this->creer)()->assertStatus(409)->assertJsonPath('code', 'payout_not_validatable');
});

it('la validation rejouée ne réécrit rien et ne consomme pas un second numéro', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = ($this->creer)()->assertCreated()->json('data.id');

    $version = $this->getJson(F::url($this->org, "/batches/{$lot}"))->json('data.lock_version');
    $a = F::valider($this, $lot, 'validation-1', $version)->assertOk();
    $b = F::valider($this, $lot, 'validation-1', $version)->assertOk();

    expect($b->json('data.number'))->toBe($a->json('data.number'))
        ->and(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(64120)
        ->and(L::dans($this->org, fn () => PayoutItem::query()->where('status', 'pending')->count()))->toBe(1);
});

it('un encaissement partiel ne facture les honoraires que sur ce qui est encaissé', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail, 35000);
    $lot = ($this->creer)()->assertCreated()->json('data.id');

    $valide = F::valider($this, $lot)->assertOk();

    expect($valide->json('data.items.0.fees_settled_amount.amount'))->toBe(2940)
        ->and($valide->json('data.items.0.net_amount.amount'))->toBe(32060);
});

it('un mandant sans compte de paiement est écarté du lot avec son motif', function (): void {
    L::dans($this->org, fn () => DB::table('bank_accounts')->delete());
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $lot = ($this->creer)()->assertCreated();

    expect($lot->json('data.items.0.status'))->toBe('excluded')->and($lot->json('data.items.0.exclusion_reason'))->toBe('no_payout_account');
    F::valider($this, $lot->json('data.id'))->assertStatus(409)->assertJsonPath('code', 'payout_not_validatable');
});

it('une retenue totale écarte le mandant, une réserve réduit le net', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $reserve = F::envoyer($this, 'POST', F::url($this->org, '/holds'), ['mandant_party_id' => $this->mandant->id, 'kind' => 'reserve', 'amount' => 10000, 'reason' => 'works_reserve'])->assertCreated();

    $apercu = $this->getJson(F::url($this->org, "/mandants/{$this->mandant->id}/account"))->assertOk();
    expect($apercu->json('data.reserve.amount'))->toBe(10000)->and($apercu->json('data.net_payable.amount'))->toBe(54120);

    F::envoyer($this, 'POST', F::url($this->org, "/holds/{$reserve->json('data.id')}/release"))->assertOk();
    F::envoyer($this, 'POST', F::url($this->org, '/holds'), ['mandant_party_id' => $this->mandant->id, 'kind' => 'full', 'reason' => 'dispute'])->assertCreated();

    $lot = ($this->creer)()->assertCreated();
    expect($lot->json('data.items.0.exclusion_reason'))->toBe('active_hold');
});

it('exclure puis réinclure une ligne exige la version courante', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = ($this->creer)()->assertCreated();
    $id = $lot->json('data.id');
    $item = $lot->json('data.items.0');

    F::envoyer($this, 'POST', F::url($this->org, "/batches/{$id}/items/{$item['id']}/exclude"), ['lock_version' => 99])->assertStatus(409)->assertJsonPath('code', 'payout_stale_version');
    $exclu = F::envoyer($this, 'POST', F::url($this->org, "/batches/{$id}/items/{$item['id']}/exclude"), ['lock_version' => $lot->json('data.lock_version')])->assertOk();
    expect($exclu->json('data.items.0.status'))->toBe('excluded')->and($exclu->json('data.items.0.exclusion_reason'))->toBe('manual');

    $nouvelle = $exclu->json('data.lock_version');
    $inclus = F::envoyer($this, 'POST', F::url($this->org, "/batches/{$id}/items/{$item['id']}/include"), ['lock_version' => $nouvelle])->assertOk();
    expect($inclus->json('data.items.0.status'))->toBe('included');
});

it('annuler un lot brouillon écarte ses lignes ; annuler un lot validé sans paiement restitue les fonds', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $brouillon = ($this->creer)()->assertCreated()->json('data.id');
    F::annuler($this, $brouillon, 'Erreur de saisie')->assertOk()->assertJsonPath('data.status', 'cancelled');

    $lot = ($this->creer)()->assertCreated()->json('data.id');
    F::valider($this, $lot)->assertOk();
    expect(F::solde($this->org, AccountRole::OwnerPayable))->toBe(0);

    F::annuler($this, $lot, 'Compte erroné')->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(64120);
});

it('un net qui a changé entre le brouillon et la validation écarte le mandant (stale) sans rien écrire', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $lot = ($this->creer)()->assertCreated()->json('data.id');
    F::envoyer($this, 'POST', F::url($this->org, '/holds'), ['mandant_party_id' => $this->mandant->id, 'kind' => 'reserve', 'amount' => 10000, 'reason' => 'works_reserve'])->assertCreated();

    $valide = F::valider($this, $lot)->assertOk();

    expect($valide->json('data.status'))->toBe('draft')
        ->and($valide->json('data.items.0.status'))->toBe('excluded')
        ->and($valide->json('data.items.0.exclusion_reason'))->toBe('stale')
        ->and(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(70000);
});
