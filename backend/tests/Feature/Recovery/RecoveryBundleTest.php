<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Recovery\RecoveryContext as X;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    X::preparer($this);
});

it('génère l\'envoi : ZIP stocké par Documents avec son empreinte, pièces et décompte figés', function (): void {
    $s = X::dossier($this);

    $reponse = $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated();

    $reponse->assertJsonPath('data.number', 'EP-2026-0001')
        ->assertJsonPath('data.case_id', $s['case'])
        ->assertJsonPath('data.total_due.amount', 210000)
        ->assertJsonPath('data.statement.totals.outstanding', 210000)
        ->assertJsonPath('data.statement.totals.called', 210000)
        ->assertJsonCount(3, 'data.statement.lines');
    expect(array_column($reponse->json('data.pieces'), 'kind'))->toBe(['statement', 'rent_notice', 'rent_notice', 'rent_notice', 'lease', 'ledger_extract']);

    L::dans($s['org'], function () use ($reponse): void {
        $envoi = RecoveryBundle::query()->findOrFail($reponse->json('data.id'));
        $fichier = StoredFile::query()->findOrFail($envoi->stored_file_id);
        $contenu = Storage::disk($fichier->disk)->get($fichier->path);
        $chemin = tempnam(sys_get_temp_dir(), 'zip');
        file_put_contents($chemin, $contenu);
        $zip = new ZipArchive;
        $zip->open($chemin);
        $noms = array_map(fn (int $i): string => (string) $zip->getNameIndex($i), range(0, $zip->numFiles - 1));
        $zip->close();
        unlink($chemin);

        expect(hash('sha256', (string) $contenu))->toBe($envoi->sha256)->and($fichier->sha256)->toBe($envoi->sha256)
            ->and($fichier->mime_type)->toBe('application/zip')
            ->and($noms)->toHaveCount(6)
            ->and($noms)->toContain('decompte-EP-2026-0001.pdf')
            ->and(IssuedDocument::query()->where('type', IssuedDocumentType::DebtStatement)->count())->toBe(1)
            ->and(IssuedDocument::query()->where('type', IssuedDocumentType::DebtStatement)->firstOrFail()->snapshot['totals']['outstanding'])->toBe(210000);
    });

    $this->getJson(X::url($s['org'], "/cases/{$s['case']}"))->assertOk()->assertJsonPath('data.bundles.0.number', 'EP-2026-0001')->assertJsonPath('data.bundles.0.pieces_count', 6);
    expect(AuditLog::query()->where('action', 'recovery.bundle.generated')->count())->toBe(1);
});

it('fige le décompte : un paiement ultérieur ne change pas un envoi déjà fait', function (): void {
    $s = X::dossier($this);
    $premier = X::envoi($this, $s);
    C::payer($this, $s['org'], $s['bail'], 70000)->assertCreated();

    $this->getJson(X::url($s['org'], "/bundles/{$premier}"))->assertOk()->assertJsonPath('data.statement.totals.outstanding', 210000)->assertJsonPath('data.total_due.amount', 210000);

    $second = $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated();
    $second->assertJsonPath('data.number', 'EP-2026-0002')->assertJsonPath('data.total_due.amount', 140000);
    expect(array_column($second->json('data.statement.lines'), 'outstanding'))->toBe([0, 70000, 70000]);
});

it('ne laisse rien si Gotenberg tombe : 503, aucun numéro consommé', function (): void {
    $s = X::dossier($this);
    C::$panneGotenberg = true;

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertStatus(503)->assertJsonPath('code', 'recovery_pdf_unavailable')->assertHeader('Retry-After', '30');
    expect(L::dans($s['org'], fn () => RecoveryBundle::query()->count()))->toBe(0)
        ->and(L::dans($s['org'], fn () => IssuedDocument::query()->where('type', IssuedDocumentType::DebtStatement)->count()))->toBe(0);

    C::$panneGotenberg = false;
    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated()->assertJsonPath('data.number', 'EP-2026-0001');
});

it('refuse un envoi sans créance ou quand tout est soldé au grand livre', function (): void {
    $s = X::dossier($this, 1);
    $ligne = $this->getJson(X::url($s['org'], "/cases/{$s['case']}"))->json('data.items.0.id');
    $this->deleteJson(X::url($s['org'], "/cases/{$s['case']}/items/{$ligne}"))->assertOk();

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertConflict()->assertJsonPath('code', 'recovery_case_empty');

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/items"), ['installment_ids' => [$s['ids'][0]]])->assertOk();
    C::payer($this, $s['org'], $s['bail'], 70000)->assertCreated();

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertConflict()->assertJsonPath('code', 'recovery_nothing_due');
    expect(L::dans($s['org'], fn () => RecoveryBundle::query()->count()))->toBe(0);
});

it('télécharge l\'envoi depuis l\'espace organisation : privé, journalisé recovery.bundle.downloaded', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $sha = $this->getJson(X::url($s['org'], "/bundles/{$bundle}"))->json('data.sha256');

    $reponse = $this->get(X::url($s['org'], "/bundles/{$bundle}/download"))->assertOk();

    expect(hash('sha256', $reponse->streamedContent()))->toBe($sha)
        ->and($reponse->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('attachment')
        ->and($reponse->headers->get('X-Content-Type-Options'))->toBe('nosniff');

    $audit = AuditLog::query()->where('action', 'recovery.bundle.downloaded')->get();
    expect($audit)->toHaveCount(1)->and($audit[0]->actor_user_id)->toBe(L::titulaire($s['org'])->id)->and($audit[0]->organization_id)->toBe($s['org']->id);
});
