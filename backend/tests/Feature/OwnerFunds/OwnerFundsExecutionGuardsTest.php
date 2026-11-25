<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutItem;
use Illuminate\Support\Facades\DB;
use Money\Currency;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
});

it('l\'exécution est refusée 409 payout_account_changed quand le compte de paiement du mandant a changé depuis la validation', function (): void {
    $ids = F::lotValide($this);
    F::compte($this->org, $this->mandant->id, '2026-12-05');

    F::executer($this, $ids)->assertStatus(409)->assertJsonPath('code', 'payout_account_changed');

    expect(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(64120);
});

it('un changement de compte reconnu explicitement permet l\'exécution et reste tracé à l\'audit', function (): void {
    $ids = F::lotValide($this);
    F::compte($this->org, $this->mandant->id, '2026-12-05');

    F::executer($this, $ids, ['acknowledge_account_change' => true])->assertOk()->assertJsonPath('data.status', 'paid');

    $audit = L::dans($this->org, fn () => DB::table('audit_logs')->where('action', 'ownerfunds.payout.executed')->value('metadata'));
    expect((string) $audit)->toContain('"account_changed":true');
});

it('sans changement de compte, l\'exécution passe sans reconnaissance et l\'audit ne signale rien', function (): void {
    $ids = F::lotValide($this);

    F::executer($this, $ids)->assertOk();

    $audit = L::dans($this->org, fn () => DB::table('audit_logs')->where('action', 'ownerfunds.payout.executed')->value('metadata'));
    expect((string) $audit)->toContain('"account_changed":false');
});

it('l\'export CSV neutralise aussi les champs qui commencent par une tabulation ou un retour chariot', function (string $nom, string $attendu): void {
    L::dans($this->org, fn () => DB::table('parties')->where('id', $this->mandant->id)->update(['display_name' => $nom]));
    $ids = F::lotValide($this);

    $contenu = $this->get(F::url($this->org, "/batches/{$ids['batch']}/export"))->assertOk()->getContent();

    expect($contenu)->toContain($attendu)->not->toContain('" =cmd()"')->not->toContain('" @cmd()"');
})->with([
    'tabulation' => ["\t=cmd()", "\"'=cmd()\""],
    'retour chariot' => ["\r=cmd()", "\"'=cmd()\""],
    'saut de ligne' => ["\n=cmd()", "\"'=cmd()\""],
    'retour chariot et saut de ligne' => ["\r\n@cmd()", "\"'@cmd()\""],
]);

it('une création de lot concurrente sur le même mandant répond 409 et non 500, sans lot orphelin', function (): void {
    $concurrent = false;
    PayoutBatch::created(function (PayoutBatch $lot) use (&$concurrent): void {
        if ($concurrent) {
            return;
        }

        $concurrent = true;
        $autre = PayoutBatch::query()->create(['status' => 'draft', 'currency' => 'EUR', 'idempotency_key' => 'course-concurrente', 'fingerprint' => str_repeat('a', 64)]);
        PayoutItem::query()->create([
            'batch_id' => $autre->id, 'mandant_party_id' => $this->mandant->id, 'status' => 'included', 'net_amount' => new Money(1, new Currency('EUR')),
            'fees_settled_amount' => new Money(0, new Currency('EUR')), 'currency' => 'EUR',
        ]);
    });

    F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertStatus(409)->assertJsonPath('code', 'payout_not_validatable');

    expect(L::dans($this->org, fn () => PayoutBatch::query()->count()))->toBe(0);
});
