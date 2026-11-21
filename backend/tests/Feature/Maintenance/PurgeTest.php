<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Parties\Actions\AnonymizeParty;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
});

/**
 * @return array{0: string, 1: string}
 */
function demandeAvecPhoto(object $test, array $scene): array
{
    $id = (string) C::signaler($test, $scene)->assertCreated()->json('data.id');
    $test->post(C::BASE."/tenant/interventions/{$id}/files", ['file' => C::photo()], ['Accept' => 'application/json'])->assertCreated();
    C::comme($test, $scene['owner']);
    $test->postJson(C::url($scene['org'], "/interventions/{$id}/decline"), ['lock_version' => 1, 'reason' => 'duplicate', 'note' => 'Doublon.'])->assertOk();

    return [$id, (string) InterventionFile::query()->withoutGlobalScopes()->where('intervention_id', $id)->value('id')];
}

it('purge les photos du locataire cinq ans après la fin de la demande, pas avant, et journalise sans texte libre', function (): void {
    [$id, $photo] = demandeAvecPhoto($this, $this->scene);

    $this->travelTo(now()->addYears(4)->addMonths(11));
    $this->artisan('maintenance:purge-media')->assertSuccessful();
    expect(InterventionFile::query()->withoutGlobalScopes()->whereKey($photo)->exists())->toBeTrue();

    $this->travelTo(now()->addMonths(2));
    $this->artisan('maintenance:purge-media')->assertSuccessful();
    $this->artisan('maintenance:purge-media')->assertSuccessful();

    expect(InterventionFile::query()->withoutGlobalScopes()->whereKey($photo)->exists())->toBeFalse()
        ->and(DB::table('stored_files')->count())->toBe(0)
        ->and(Intervention::query()->withoutGlobalScopes()->whereKey($id)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'maintenance.file.purged')->count())->toBe(1);
});

it('ne purge jamais un devis, une facture ou une preuve, même au-delà de cinq ans', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    expect($id)->not->toBe('');
    $devis = InterventionFile::query()->withoutGlobalScopes()->where('kind', 'quote')->count();
    $this->travelTo(now()->addYears(6));
    $this->artisan('maintenance:purge-media')->assertSuccessful();

    expect(InterventionFile::query()->withoutGlobalScopes()->where('kind', 'quote')->count())->toBe($devis)->and($devis)->toBeGreaterThan(0);
});

it('à l\'anonymisation du locataire : texte libre remplacé, la ligne reste, les photos suivent leur échéance', function (): void {
    [$id] = demandeAvecPhoto($this, $this->scene);
    L::dans($this->scene['org'], fn () => app(AnonymizeParty::class)->handle($this->scene['tenantParty'], 'requested'));

    $this->artisan('maintenance:purge-media')->assertSuccessful();

    $intervention = Intervention::query()->withoutGlobalScopes()->findOrFail($id);
    expect($intervention->description)->toBe('[effacé]')->and($intervention->title)->toBe('[effacé]')
        ->and(InterventionFile::query()->withoutGlobalScopes()->where('intervention_id', $id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'maintenance.intervention.erased')->count())->toBe(1);

    $this->artisan('maintenance:purge-media')->assertSuccessful();
    expect(AuditLog::query()->where('action', 'maintenance.intervention.erased')->count())->toBe(1);
});

it('à l\'anonymisation du locataire : ses commentaires sont effacés, ceux de l\'équipe et la chronologie restent', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $this->postJson(C::BASE."/tenant/interventions/{$id}/comments", ['text' => 'Mon code de porte est 4521'])->assertCreated();
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/comments"), ['text' => 'Appelé le locataire', 'visible_to_tenant' => false])->assertCreated();
    L::dans($this->scene['org'], fn () => app(AnonymizeParty::class)->handle($this->scene['tenantParty'], 'requested'));

    $this->artisan('maintenance:purge-media')->assertSuccessful();

    $textes = DB::table('intervention_events')->where('intervention_id', $id)->where('kind', 'comment')->orderBy('created_at')->pluck('text', 'actor_kind')->all();
    expect($textes)->toBe(['tenant' => '[effacé]', 'team' => 'Appelé le locataire'])
        ->and(DB::table('intervention_events')->where('intervention_id', $id)->count())->toBeGreaterThan(2);
});

it('l\'anonymisation ne touche pas les factures reçues du prestataire', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/invoices"), [
        'number' => 'F-RGPD', 'invoice_on' => '2026-11-20', 'file_id' => C::fichier($this, $this->scene, $id, 'invoice'),
        'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]], 'idempotency_key' => 'facture-rgpd',
    ])->assertCreated();
    $avant = DB::table('supplier_invoices')->first();

    L::dans($this->scene['org'], fn () => app(AnonymizeParty::class)->handle($this->scene['supplier'], 'requested'));
    $this->artisan('maintenance:purge-media')->assertSuccessful();

    $apres = DB::table('supplier_invoices')->first();
    expect($apres->snapshot)->toBe($avant->snapshot)->and($apres->number)->toBe('F-RGPD');
});

it('le journal d\'audit ne contient aucun texte libre ni donnée personnelle', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/comments"), ['text' => 'Mot de passe wifi du locataire : SECRET123', 'visible_to_tenant' => false])->assertCreated();

    $journal = AuditLog::query()->where('action', 'like', 'maintenance.%')->get()->map(fn (AuditLog $ligne): string => json_encode($ligne->metadata ?? []).json_encode($ligne->changes ?? []))->implode(' ');

    expect(AuditLog::query()->where('action', 'like', 'maintenance.%')->count())->toBeGreaterThan(5)
        ->and($journal)->not->toContain('SECRET123')->not->toContain('évier')->not->toContain('Siphon')->not->toContain('IBAN');
});
