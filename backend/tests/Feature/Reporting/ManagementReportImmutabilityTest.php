<?php

declare(strict_types=1);

use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Models\ManagementReportLine;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    R::parcours($this);
    $this->id = R::rapport($this);
    R::publier($this, $this->id)->assertOk();
});

it('la base refuse toute modification des chiffres, du snapshot ou du numéro d\'un compte rendu publié', function (string $colonne, mixed $valeur): void {
    expect(fn () => R::dans($this->org, fn () => DB::table('management_reports')->where('id', $this->id)->update([$colonne => $valeur])))->toThrow(QueryException::class);
})->with([
    'solde de clôture' => ['closing_balance', 1],
    'honoraires' => ['fees_total', 1],
    'snapshot' => ['snapshot', '{}'],
    'numéro' => ['number', 'CR-2027-9999'],
    'empreinte' => ['fingerprint', 'a'],
    'motif' => ['rectification_reason', 'x'],
    'date de publication' => ['published_at', '2020-01-01 00:00:00.000000'],
]);

it('la base refuse la suppression d\'un compte rendu et toute écriture sur ses lignes une fois publié', function (): void {
    expect(fn () => R::dans($this->org, fn () => DB::table('management_reports')->where('id', $this->id)->delete()))->toThrow(QueryException::class)
        ->and(fn () => R::dans($this->org, fn () => DB::table('management_report_lines')->where('report_id', $this->id)->update(['amount' => 1])))->toThrow(QueryException::class)
        ->and(fn () => R::dans($this->org, fn () => DB::table('management_report_lines')->where('report_id', $this->id)->delete()))->toThrow(QueryException::class)
        ->and(fn () => R::dans($this->org, fn () => ManagementReportLine::query()->where('report_id', $this->id)->firstOrFail()->replicate()->forceFill(['position' => 99])->save()))->toThrow(QueryException::class);
});

it('l\'API ne modifie, ne régénère ni n\'abandonne un compte rendu publié', function (): void {
    $version = $this->getJson(R::url($this->org, "/management-reports/{$this->id}"))->json('data.lock_version');

    $this->patchJson(R::url($this->org, "/management-reports/{$this->id}"), ['lock_version' => $version, 'notify' => false])->assertStatus(409)->assertJsonPath('code', 'report_not_editable');
    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/generate"))->assertStatus(409)->assertJsonPath('code', 'report_not_editable');
    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/discard"))->assertStatus(409)->assertJsonPath('code', 'report_not_editable');
});

it('un rectificatif exige un motif et ne touche pas l\'original avant sa publication', function (): void {
    $avant = R::dans($this->org, fn () => DB::table('management_reports')->where('id', $this->id)->first());

    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), [])->assertUnprocessable();
    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'court'])->assertUnprocessable();

    $rectificatif = $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Erreur de ventilation des honoraires'])->assertCreated();

    expect($rectificatif->json('data.status'))->toBe('generated')
        ->and($rectificatif->json('data.supersedes_id'))->toBe($this->id)
        ->and($rectificatif->json('data.rectification_reason'))->toBe('Erreur de ventilation des honoraires')
        ->and($rectificatif->json('data.number'))->toBeNull()
        ->and(R::dans($this->org, fn () => (array) DB::table('management_reports')->where('id', $this->id)->first()))->toEqual((array) $avant);

    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Une seconde demande en parallèle'])->assertStatus(409)->assertJsonPath('code', 'report_not_editable');
});

it('la publication du rectificatif remplace l\'original, qui reste lisible et téléchargeable', function (): void {
    $nouveau = $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Erreur de ventilation des honoraires'])->assertCreated()->json('data.id');

    R::publier($this, $nouveau)->assertOk()->assertJsonPath('data.number', 'CR-2027-0002')->assertJsonPath('data.status', 'published');

    $original = $this->getJson(R::url($this->org, "/management-reports/{$this->id}"))->assertOk();
    expect($original->json('data.status'))->toBe('superseded')->and($original->json('data.number'))->toBe('CR-2027-0001');
    $this->get(R::url($this->org, "/management-reports/{$this->id}/pdf"))->assertOk();

    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Rectifier un compte rendu remplacé'])->assertStatus(409);
    R::creer($this)->assertStatus(409)->assertJsonPath('data.0.error.code', 'report_period_overlap');

    $actions = R::dans($this->org, fn () => AuditLog::query()->pluck('action')->all());
    expect($actions)->toContain('reporting.report.rectified');
});

it('un rectificatif abandonné laisse l\'original publié et libère un nouveau rectificatif', function (): void {
    $nouveau = $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Erreur de ventilation des honoraires'])->assertCreated()->json('data.id');

    $this->postJson(R::url($this->org, "/management-reports/{$nouveau}/discard"))->assertOk();
    $this->postJson(R::url($this->org, "/management-reports/{$this->id}/rectify"), ['reason' => 'Nouvelle tentative de rectification'])->assertCreated();

    expect(R::dans($this->org, fn () => ManagementReport::query()->findOrFail($this->id)->status->value))->toBe('published');
});
