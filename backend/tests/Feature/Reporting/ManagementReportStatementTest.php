<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Reporting\Support\Csv;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    R::parcours($this);
});

it('le relevé du mandant reproduit le compte OwnerPayable : ouverture, lignes, clôture', function (): void {
    $url = fn (string $de, string $a): string => R::url($this->org, "/mandants/{$this->mandant->id}/statement?from={$de}&to={$a}");

    $novembre = $this->getJson($url('2026-11-01', '2026-11-30'))->assertOk()->json('data');
    $decembre = $this->getJson($url('2026-12-01', '2026-12-31'))->assertOk()->json('data');

    expect($novembre['opening_balance']['amount'])->toBe(0)
        ->and($novembre['closing_balance']['amount'])->toBe(70000)
        ->and($novembre['lines'])->toHaveCount(1)
        ->and($novembre['lines'][0]['credit']['amount'])->toBe(70000)
        ->and($novembre['lines'][0]['balance']['amount'])->toBe(70000)
        ->and($decembre['opening_balance']['amount'])->toBe(70000)
        ->and($decembre['closing_balance']['amount'])->toBe(F::solde($this->org, AccountRole::OwnerPayable))
        ->and(collect($decembre['lines'])->sum('debit.amount'))->toBe(70000)
        ->and(R::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.statement.viewed')->count()))->toBe(2);
});

it('le relevé exige une période valide et un mandant de l\'organisation', function (): void {
    $this->getJson(R::url($this->org, "/mandants/{$this->mandant->id}/statement"))->assertUnprocessable();
    $this->getJson(R::url($this->org, "/mandants/{$this->mandant->id}/statement?from=2026-12-01&to=2026-11-01"))->assertUnprocessable();
    $this->getJson(R::url($this->org, '/mandants/'.Str::uuid().'/statement?from=2026-11-01&to=2026-11-30'))->assertNotFound()->assertJsonPath('code', 'report_mandant_not_found');
});

it('le relevé s\'exporte en CSV privé', function (): void {
    $r = $this->get(R::url($this->org, "/mandants/{$this->mandant->id}/statement?from=2026-11-01&to=2026-11-30&format=csv"))->assertOk();

    expect($r->headers->get('Content-Type'))->toContain('text/csv')
        ->and($r->headers->get('Cache-Control'))->toContain('no-store')
        ->and($r->getContent())->toContain('debit_minor')->toContain('70000');
});

it('les lignes d\'un compte rendu s\'exportent en CSV pour un comptable authentifié à deux facteurs', function (): void {
    $id = R::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);
    X::changer();
    $this->actingAs(F::comptable($this->org));

    $r = $this->get(R::url($this->org, "/management-reports/{$id}/lines.csv"))->assertOk();
    expect($r->getContent())->toContain('"date";"type";"libelle";"sens";"montant_minor";"devise"')->toContain('"payout"')->toContain(';64120;"EUR"')
        ->and(R::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.export.generated')->count()))->toBe(1);

    config(['reporting.export_max_rows' => 1]);
    $this->get(R::url($this->org, "/management-reports/{$id}/lines.csv"))->assertUnprocessable()->assertJsonPath('code', 'export_too_large');
});

it('un champ qui commence par une formule est neutralisé dans le CSV, les entiers restent des nombres', function (): void {
    $csv = Csv::render([['=SUM(A1)', '+1', '@x', 'normal', -5, 7]]);

    expect($csv)->toContain("\"'=SUM(A1)\";\"'+1\";\"'@x\";\"normal\";-5;7");
});
