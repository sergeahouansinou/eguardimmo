<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Reporting\Models\ManagementReport;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    $this->equipe = N::equipe($this->org);
});

it('reporting:flag-due prévient propriétaire et gestionnaire, pas le comptable, une fois par mandant et par période, sans nom ni montant', function (): void {
    R::parcours($this);

    $this->artisan('reporting:flag-due')->assertExitCode(0)->expectsOutputToContain('1 compte(s) rendu(s) à produire');
    $this->artisan('reporting:flag-due')->assertExitCode(0);

    expect(N::nombre($this->equipe['owner'], Type::ReportingReportsDue))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::ReportingReportsDue))->toBe(1)
        ->and(N::nombre($this->equipe['accountant'], Type::ReportingReportsDue))->toBe(0);

    $notification = R::dans($this->org, fn () => Notification::query()->where('type', Type::ReportingReportsDue->value)->firstOrFail());
    expect($notification->title.$notification->body)->not->toContain($this->mandant->id)->not->toContain('70000')
        ->and($notification->dedup_key)->toBe("due:{$this->mandant->id}:2026-12-01");
});

it('reporting:flag-due ne signale plus un mandant dont la période est couverte', function (): void {
    R::parcours($this);
    R::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);

    $this->artisan('reporting:flag-due')->assertExitCode(0)->expectsOutputToContain('0 compte(s)');

    expect(N::nombre($this->equipe['owner'], Type::ReportingReportsDue))->toBe(0);
});

it('reporting:publish-scheduled publie à l\'échéance, sans auteur, et laisse généré un compte rendu dont la période n\'est pas close', function (): void {
    R::parcours($this);
    $id = R::planifie($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);

    $this->artisan('reporting:publish-scheduled')->assertExitCode(0)->expectsOutputToContain('0 publié');
    expect(R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id)->status->value))->toBe('generated');

    $this->travelTo(CarbonImmutable::parse('2027-01-12 08:00:00'));
    $this->artisan('reporting:publish-scheduled')->assertExitCode(0)->expectsOutputToContain('1 publié');

    $rapport = R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id));
    expect($rapport->status->value)->toBe('published')->and($rapport->published_by_user_id)->toBeNull()->and($rapport->number)->toBe('CR-2027-0001')
        ->and(R::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.report.published')->firstOrFail()->metadata['scheduled']))->toBeTrue();
});

it('reporting:publish-scheduled échoue en le disant quand la période n\'est pas close', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
    $id = R::planifie($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);
    $this->travelTo(CarbonImmutable::parse('2027-01-12 08:00:00'));

    $this->artisan('reporting:publish-scheduled')->assertExitCode(1)->expectsOutputToContain('1 refusé');

    expect(R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id)->status->value))->toBe('generated');
});

it('reporting:verify passe sur un compte rendu publié intact et signale un compte rendu qui diverge ou qui est incomplet', function (): void {
    R::parcours($this);
    $id = R::rapport($this);
    R::publier($this, $id)->assertOk();

    $this->artisan('reporting:verify')->assertExitCode(0)->expectsOutputToContain('conformes');

    R::dans($this->org, function () use ($id): void {
        DB::statement('DROP TRIGGER management_reports_figee');
        DB::table('management_reports')->where('id', $id)->update(['fingerprint' => str_repeat('a', 64)]);
    });
    $this->artisan('reporting:verify')->assertExitCode(1)->expectsOutputToContain('published_report_differs_from_ledger');

    R::dans($this->org, fn () => DB::table('management_reports')->where('id', $id)->update(['stored_file_id' => null]));
    $this->artisan('reporting:verify')->assertExitCode(1)->expectsOutputToContain('published_report_incomplete');

    expect(R::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.verify.anomaly')->count()))->toBe(2);
});
