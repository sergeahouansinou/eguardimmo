<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Reporting\Events\ManagementReportPublished;
use App\Modules\Reporting\Models\ManagementReport;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
});

it('parcours nominal : loyer, honoraires, reversement, clôture puis comptes rendus égaux au grand livre', function (): void {
    R::parcours($this);

    $novembre = R::creer($this)->assertCreated();
    $decembre = R::creer($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31'])->assertCreated();

    $nov = $novembre->json('data.0.report');
    $dec = $decembre->json('data.0.report');

    expect($nov['status'])->toBe('generated')
        ->and($nov['totals']['opening_balance']['amount'])->toBe(0)
        ->and($nov['totals']['collected']['amount'])->toBe(70000)
        ->and($nov['totals']['fees']['amount'])->toBe(0)
        ->and($nov['totals']['closing_balance']['amount'])->toBe(70000)
        ->and($dec['totals']['opening_balance']['amount'])->toBe(70000)
        ->and($dec['totals']['collected']['amount'])->toBe(0)
        ->and($dec['totals']['fees']['amount'])->toBe(5880)
        ->and($dec['totals']['payout']['amount'])->toBe(64120)
        ->and($dec['totals']['closing_balance']['amount'])->toBe(F::solde($this->org, AccountRole::OwnerPayable))
        ->and($dec['totals']['closing_balance']['amount'])->toBe(0);
});

it('publie un compte rendu : numéro continu, PDF scellé, pièce émise, audit, puis téléchargement privé', function (): void {
    R::parcours($this);
    $id = R::rapport($this);

    $publie = R::publier($this, $id)->assertOk();

    expect($publie->json('data.status'))->toBe('published')
        ->and($publie->json('data.number'))->toBe('CR-2027-0001')
        ->and($publie->json('data.published_at'))->not->toBeNull();

    $rapport = R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id));
    expect($rapport->issued_document_id)->not->toBeNull()->and($rapport->stored_file_id)->not->toBeNull();

    $pdf = $this->get(R::url($this->org, "/management-reports/{$id}/pdf"))->assertOk();
    expect($pdf->headers->get('Content-Type'))->toContain('application/pdf')
        ->and($pdf->headers->get('Cache-Control'))->toContain('no-store')
        ->and(R::dans($this->org, fn () => AuditLog::query()->whereIn('action', ['reporting.report.published', 'reporting.report.downloaded'])->pluck('action')->all()))
        ->toContain('reporting.report.published', 'reporting.report.downloaded');

    R::publier($this, $id)->assertOk()->assertJsonPath('data.number', 'CR-2027-0001');
    expect(R::dans($this->org, fn () => DB::table('management_report_sequences')->value('last_value')))->toBe(1);
});

it('un compte rendu généré a un aperçu PDF filigrané qui ne stocke rien', function (): void {
    R::parcours($this);
    $id = R::rapport($this);

    $this->get(R::url($this->org, "/management-reports/{$id}/pdf"))->assertOk()->assertHeader('Content-Disposition', 'inline; filename="projet-compte-rendu.pdf"');

    $rapport = R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id));
    expect($rapport->stored_file_id)->toBeNull();
});

it('les lignes du compte rendu correspondent aux écritures : appels, encaissements, honoraires et TVA, reversement', function (): void {
    R::parcours($this);
    $decembre = R::creer($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31'])->assertCreated()->json('data.0.report.id');

    $lignes = collect($this->getJson(R::url($this->org, "/management-reports/{$decembre}"))->json('data.lines'));
    $parGenre = $lignes->groupBy('kind')->map(fn ($g) => $g->sum('amount.amount'));

    expect($parGenre->get('fee'))->toBe(4900)
        ->and($parGenre->get('fee_vat'))->toBe(980)
        ->and($parGenre->get('payout'))->toBe(64120)
        ->and($lignes->pluck('position')->all())->toBe(range(1, $lignes->count()));
});

it('la publication émet un événement après validation de la transaction, sans rejeu sur une republication', function (): void {
    R::parcours($this);
    $id = R::rapport($this, ['notify' => false]);
    Event::fake([ManagementReportPublished::class]);

    R::publier($this, $id)->assertOk();
    R::publier($this, $id)->assertOk();

    Event::assertDispatchedTimes(ManagementReportPublished::class, 1);
    Event::assertDispatched(ManagementReportPublished::class, fn ($e): bool => $e->reportId === $id && $e->notify === false && $e->rectification === false && $e->mandantPartyId === $this->mandant->id);
});
