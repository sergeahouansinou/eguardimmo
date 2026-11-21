<?php

declare(strict_types=1);

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Models\PayoutItem;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function lotValide(object $test): array
{
    F::encaisserEtCloturer($test, $test->org, $test->bail);
    $lot = F::envoyer($test, 'POST', F::url($test->org, '/batches'), ['mandant_ids' => [$test->mandant->id]])->assertCreated();
    $valide = F::valider($test, $lot->json('data.id'))->assertOk();

    return ['batch' => $valide->json('data.id'), 'item' => $valide->json('data.items.0.id')];
}

function executer(object $test, array $ids, array $corps = [], ?string $cle = null): TestResponse
{
    return F::envoyer($test, 'POST', F::url($test->org, "/batches/{$ids['batch']}/items/{$ids['item']}/execute"), ['executed_on' => '2026-12-10', 'reference' => 'VIR-1', ...$corps], $cle);
}

function ecartCantonnement(object $test, int $montant): void
{
    L::dans($test->org, fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-12-10'), 'Prélèvement indu', SourceType::TrustTransfer, (string) Str::uuid7(), 'ecart-'.Str::random(8),
        [LineData::debit(AccountRole::Bank, Money::EUR($montant)), LineData::credit(AccountRole::TrustBank, Money::EUR($montant))],
    )));
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
});

it('double contrôle : celui qui a validé ne peut pas exécuter quand l\'équipe compte un second membre autorisé', function (): void {
    F::comptable($this->org);
    $ids = lotValide($this);

    executer($this, $ids)->assertForbidden()->assertJsonPath('code', 'payout_second_approver_required');
    expect(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(64120);
});

it('sans second membre ou avec la règle désactivée, l\'exécution passe et est journalisée en solo', function (): void {
    $ids = lotValide($this);

    $reponse = executer($this, $ids)->assertOk();

    expect($reponse->json('data.status'))->toBe('paid')->and($reponse->json('data.executed_solo'))->toBeTrue();
});

it('l\'exécution rejouée sous la même clé ne repasse pas d\'écriture ; sous une autre clé la ligne n\'est plus actionnable', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));

    executer($this, $ids, [], 'exec-rejeu-1')->assertOk();
    executer($this, $ids, [], 'exec-rejeu-1')->assertOk();
    executer($this, $ids, [], 'exec-rejeu-2')->assertStatus(409)->assertJsonPath('code', 'payout_item_not_actionable');

    expect(F::solde($this->org, AccountRole::TrustBank))->toBe(-5880);
});

it('la date d\'exécution ne peut ni précéder la validation ni être future', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));

    executer($this, $ids, ['executed_on' => '2026-12-09'])->assertStatus(409)->assertJsonPath('code', 'payout_item_not_actionable');
    executer($this, $ids, ['executed_on' => '2026-12-11'])->assertStatus(422);
});

it('un virement échoué restitue le montant au compte du mandant et libère le mandant pour un nouveau lot', function (): void {
    $ids = lotValide($this);

    $echec = F::envoyer($this, 'POST', F::url($this->org, "/batches/{$ids['batch']}/items/{$ids['item']}/fail"), ['reason' => 'IBAN refusé par la banque'])->assertOk();

    expect($echec->json('data.status'))->toBe('failed')
        ->and(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(64120);
    F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated();
});

it('un virement retourné par la banque après exécution reconstitue la dette envers le mandant', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));
    executer($this, $ids)->assertOk();

    $retour = F::envoyer($this, 'POST', F::url($this->org, "/batches/{$ids['batch']}/items/{$ids['item']}/return"), ['reason' => 'Compte clôturé'])->assertOk();

    expect($retour->json('data.status'))->toBe('returned')
        ->and(F::solde($this->org, AccountRole::PayoutsInTransit))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(64120)
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(-70000);
});

it('un écart de cantonnement bloque la validation, le prélèvement et la clôture ; un apport le résorbe', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    ecartCantonnement($this, 10000);

    $couverture = $this->getJson(F::url($this->org, '/trust/coverage'))->assertOk();
    expect($couverture->json('data.covered'))->toBeFalse();

    $lot = F::envoyer($this, 'POST', F::url($this->org, '/batches'), ['mandant_ids' => [$this->mandant->id]])->assertCreated()->json('data.id');
    F::valider($this, $lot)->assertStatus(409)->assertJsonPath('code', 'trust_funds_gap');
    F::envoyer($this, 'POST', F::url($this->org, '/trust/withdrawals'), ['amount' => 100, 'executed_on' => '2026-12-10'])->assertStatus(409)->assertJsonPath('code', 'trust_funds_gap');

    F::apporter($this, 10000, '2026-12-10');
    expect($this->getJson(F::url($this->org, '/trust/coverage'))->json('data.covered'))->toBeTrue();
    F::valider($this, $lot)->assertOk();
});

it('un écart de cantonnement bloque la clôture du mois', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    L::dans($this->org, fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-12-10'), 'Prélèvement indu', SourceType::TrustTransfer, (string) Str::uuid7(), 'ecart-cloture',
        [LineData::debit(AccountRole::Bank, Money::EUR(500)), LineData::credit(AccountRole::TrustBank, Money::EUR(500))],
    )));
    $this->travelTo(CarbonImmutable::parse('2027-01-05 10:00:00'));

    F::envoyer($this, 'POST', "/api/v1/org/{$this->org->id}/accounting/periods/close", ['month' => '2026-12'])->assertStatus(409)->assertJsonPath('code', 'accounting_period_not_closable');
});

it('le prélèvement des honoraires est plafonné à l\'excédent de l\'équation', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));
    executer($this, $ids)->assertOk();

    F::envoyer($this, 'POST', F::url($this->org, '/trust/withdrawals'), ['amount' => 5881, 'executed_on' => '2026-12-10'])->assertStatus(409)->assertJsonPath('code', 'trust_withdrawal_exceeds_surplus');
    $ok = F::envoyer($this, 'POST', F::url($this->org, '/trust/withdrawals'), ['amount' => 5880, 'executed_on' => '2026-12-10', 'reference' => 'PREL-1'])->assertCreated();

    expect($ok->json('data.amount.amount'))->toBe(5880)
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(0)
        ->and($this->getJson(F::url($this->org, '/trust/coverage'))->json('data.covered'))->toBeTrue();
});

it('l\'export CSV ne contient jamais l\'IBAN complet, neutralise les formules et n\'est pas mis en cache', function (): void {
    L::dans($this->org, fn () => DB::table('parties')->where('id', $this->mandant->id)->update(['display_name' => '=SOMME(A1)']));
    $ids = lotValide($this);

    $csv = $this->get(F::url($this->org, "/batches/{$ids['batch']}/export"))->assertOk();

    expect($csv->headers->get('Content-Type'))->toContain('text/csv')
        ->and($csv->headers->get('Cache-Control'))->toContain('no-store')
        ->and($csv->getContent())->toContain('"4321"')->toContain("\"'=SOMME(A1)\"")->toContain('64120')->toContain('RV-2026-')
        ->and(preg_match('/[A-Z]{2}\d{2}[A-Z0-9]{10,}/', $csv->getContent()))->toBe(0);
});

it('l\'audit des reversements, prélèvements et clôtures ne contient aucun montant ni IBAN', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));
    executer($this, $ids)->assertOk();

    $journal = L::dans($this->org, fn () => DB::table('audit_logs')->whereIn('action', ['ownerfunds.batch.validated', 'ownerfunds.payout.executed', 'accounting.period.closed'])->get());
    $actions = $journal->pluck('action')->unique()->sort()->values()->all();

    expect($actions)->toBe(['accounting.period.closed', 'ownerfunds.batch.validated', 'ownerfunds.payout.executed'])
        ->and(json_encode($journal))->not->toContain('64120')->not->toContain('4321');
});

it('la ligne exécutée et ses écritures sont figées : plus de modification ni de suppression directe', function (): void {
    $ids = lotValide($this);
    $this->actingAs(F::comptable($this->org));
    executer($this, $ids)->assertOk();

    expect(fn () => L::dans($this->org, fn () => PayoutItem::query()->whereKey($ids['item'])->update(['status' => 'pending'])))->toThrow(QueryException::class)
        ->and(fn () => L::dans($this->org, fn () => PayoutItem::query()->whereKey($ids['item'])->delete()))->toThrow(QueryException::class);
});
