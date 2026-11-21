<?php

declare(strict_types=1);

use App\Modules\Documents\Models\StoredFile;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use App\Modules\Recovery\Listeners\SendBundleLink;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Models\RecoveryTransmissionDownload;
use App\Modules\Rent\Models\Installment;
use App\Shared\Audit\AuditLog;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Events\RequestSending;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Recovery\RecoveryContext as X;

beforeEach(function (): void {
    X::preparer($this);
});

function hardeningAnonyme(): void
{
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
}

function hardeningLien(string $jeton, string $suffixe = ''): string
{
    return '/api/v1/recovery/downloads/'.$jeton.$suffixe;
}

it('limiteur du lien public : seau distinct de la connexion, dans les deux sens', function (): void {
    $s = X::transmis($this);
    hardeningAnonyme();

    foreach (range(1, 5) as $i) {
        $this->postJson('/auth/login', ['email' => 'pirate@exemple.fr', 'password' => 'faux'])->assertStatus(422);
    }

    $this->postJson('/auth/login', ['email' => 'pirate@exemple.fr', 'password' => 'faux'])->assertStatus(429);
    $this->get(hardeningLien($s['token']))->assertOk();

    foreach (range(1, 4) as $i) {
        $this->getJson(hardeningLien(Str::random(48)))->assertNotFound();
    }

    $this->getJson(hardeningLien(Str::random(48)))->assertStatus(429);
    $this->postJson('/auth/login', ['email' => 'autre@exemple.fr', 'password' => 'faux'])->assertStatus(422);
});

it('limiteur du lien public : ni ?email= aléatoire ni X-Forwarded-For forgé n\'ouvrent un nouveau seau', function (): void {
    $s = X::transmis($this);
    hardeningAnonyme();

    foreach (range(1, 5) as $i) {
        $this->getJson(hardeningLien(Str::random(48), '?email='.Str::random(8).'@exemple.fr'))->assertNotFound();
    }

    $this->getJson(hardeningLien(Str::random(48), '?email='.Str::random(8).'@exemple.fr'))->assertStatus(429);
    $this->getJson(hardeningLien($s['token']), ['X-Forwarded-For' => '203.0.113.'.random_int(1, 254), 'X-Real-IP' => '198.51.100.7', 'X-Console-Client-Ip' => '192.0.2.9'])->assertStatus(429);
});

it('la limite du lien public se règle par configuration', function (): void {
    config(['recovery.rate_limits.download_per_minute' => 2]);
    hardeningAnonyme();

    $this->getJson(hardeningLien(Str::random(48)))->assertNotFound();
    $this->getJson(hardeningLien(Str::random(48)))->assertNotFound();
    $this->getJson(hardeningLien(Str::random(48)))->assertStatus(429);
});

it('clôturer un dossier révoque ses liens actifs, avec un acte revocation par lien, et le lien répond 404', function (): void {
    config(['recovery.rate_limits.download_per_minute' => 50]);

    foreach (['closed', 'uncollectible'] as $statut) {
        $s = X::transmis($this);
        $this->postJson(X::url($s['org'], "/bundles/{$s['bundle']}/transmissions"), ['recipient_party_id' => $s['bailiff']])->assertCreated();
        $second = X::jeton();

        hardeningAnonyme();
        $this->get(hardeningLien($s['token']))->assertOk();
        X::basculer($this, $s['org']);

        $this->postJson(X::url($s['org'], "/cases/{$s['case']}/status"), ['status' => $statut, 'reason' => 'Fin'])->assertOk();

        L::dans($s['org'], function () use ($s): void {
            $actes = RecoveryAct::query()->where('case_id', $s['case'])->where('type', 'revocation')->get();

            expect($actes)->toHaveCount(2)
                ->and(RecoveryTransmission::query()->whereNull('revoked_at')->count())->toBe(0)
                ->and(AuditLog::query()->where('action', 'recovery.transmission.revoked')->where('organization_id', $s['org']->id)->count())->toBeGreaterThanOrEqual(2);
        });

        hardeningAnonyme();
        $this->getJson(hardeningLien($s['token']))->assertNotFound()->assertJsonPath('code', 'recovery_link_not_found');
        $this->getJson(hardeningLien($second))->assertNotFound()->assertJsonPath('code', 'recovery_link_not_found');
    }
});

it('un lien encore actif sur un dossier clos par une autre voie répond 404 et ne compte rien', function (): void {
    $s = X::transmis($this);
    DB::table('recovery_cases')->where('id', $s['case'])->update(['status' => 'closed']);
    hardeningAnonyme();

    $this->getJson(hardeningLien($s['token']))->assertNotFound()->assertJsonPath('code', 'recovery_link_not_found');
    $this->call('HEAD', hardeningLien($s['token']))->assertNotFound();
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($s['transmission'])->download_count))->toBe(0);
});

it('un dossier en plan ou rouvert reste téléchargeable', function (): void {
    $s = X::transmis($this);
    $url = X::url($s['org'], "/cases/{$s['case']}/status");
    $this->postJson($url, ['status' => 'in_plan'])->assertOk();
    hardeningAnonyme();
    $this->get(hardeningLien($s['token']))->assertOk();
    X::basculer($this, $s['org']);
    $this->postJson($url, ['status' => 'open'])->assertOk();
    hardeningAnonyme();
    $this->travel(2)->minutes();
    $this->get(hardeningLien($s['token']))->assertOk();
    expect(L::dans($s['org'], fn () => RecoveryAct::query()->where('type', 'revocation')->count()))->toBe(0);
});

it('HEAD n\'a aucun effet de bord ; GET compte ; HEAD d\'un lien invalide donne le même 404', function (): void {
    $s = X::transmis($this);
    hardeningAnonyme();

    $this->call('HEAD', hardeningLien($s['token']))->assertOk();
    $this->call('HEAD', hardeningLien($s['token']))->assertOk();

    L::dans($s['org'], function () use ($s): void {
        $t = RecoveryTransmission::query()->findOrFail($s['transmission']);

        expect($t->download_count)->toBe(0)->and($t->first_downloaded_at)->toBeNull()
            ->and(RecoveryTransmissionDownload::query()->count())->toBe(0);
    });
    expect(AuditLog::query()->whereIn('action', ['recovery.transmission.downloaded', 'documents.file.downloaded'])->count())->toBe(0);

    $this->call('HEAD', hardeningLien(Str::random(48)))->assertNotFound();

    $this->get(hardeningLien($s['token']))->assertOk();
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($s['transmission'])->download_count))->toBe(1);
});

it('ne compte pas un téléchargement dont le fichier est absent, et ne fuit aucun détail', function (): void {
    $s = X::transmis($this);
    $chemin = L::dans($s['org'], fn () => StoredFile::query()->findOrFail(RecoveryBundle::query()->findOrFail($s['bundle'])->stored_file_id)->path);
    Storage::disk('documents')->delete($chemin);
    hardeningAnonyme();

    $reponse = $this->getJson(hardeningLien($s['token']))->assertStatus(500);

    expect((string) $reponse->getContent())->not->toContain($chemin)->not->toContain('documents')
        ->and(L::dans($s['org'], fn () => RecoveryTransmission::query()->findOrFail($s['transmission'])->download_count))->toBe(0)
        ->and(L::dans($s['org'], fn () => RecoveryTransmissionDownload::query()->count()))->toBe(0)
        ->and(AuditLog::query()->where('action', 'recovery.transmission.downloaded')->count())->toBe(0);
});

it('limite la génération d\'envois par organisation et par utilisateur', function (): void {
    config(['recovery.rate_limits.generation_per_minute' => 2]);
    $s = X::dossier($this);
    $url = X::url($s['org'], "/cases/{$s['case']}/bundles");

    $this->postJson($url)->assertCreated();
    $this->postJson($url)->assertCreated();
    $this->postJson($url)->assertStatus(429);
    $this->travel(2)->minutes();
    $this->postJson($url)->assertCreated();
});

it('rend les PDF hors de toute transaction : aucun verrou tenu pendant les appels Gotenberg', function (): void {
    $s = X::dossier($this);
    $base = DB::transactionLevel();
    $niveaux = [];
    Event::listen(RequestSending::class, function () use (&$niveaux): void {
        $niveaux[] = DB::transactionLevel();
    });

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated();

    expect($niveaux)->toHaveCount(3)->and(array_unique($niveaux))->toBe([$base]);
});

it('refait le rendu si une génération concurrente a pris le numéro, sans laisser de fichier orphelin', function (): void {
    $s = X::dossier($this);
    $fait = false;
    Event::listen(RequestSending::class, function () use (&$fait, $s): void {
        if (! $fait) {
            $fait = true;
            DB::table('recovery_sequences')->insert(['organization_id' => $s['org']->id, 'kind' => 'bundle', 'year' => 2026, 'last_value' => 1]);
        }
    });

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertCreated()->assertJsonPath('data.number', 'EP-2026-0002');

    L::dans($s['org'], function (): void {
        expect(RecoveryBundle::query()->count())->toBe(1)
            ->and(StoredFile::query()->where('category', 'bundle')->count())->toBe(1)
            ->and(count(Storage::disk('documents')->allFiles()))->toBe(StoredFile::query()->count());
    });
});

it('revendique chaque créance en base : insertion directe refusée, libération au retrait et à la clôture', function (): void {
    $s = X::dossier($this, 2);
    $revendications = fn () => DB::table('recovery_item_claims')->where('case_id', $s['case']);

    expect($revendications()->count())->toBe(2);

    expect(fn () => DB::table('recovery_item_claims')->insert([
        'organization_id' => $s['org']->id, 'item_type' => 'installment', 'item_id' => $s['ids'][0], 'case_id' => $s['case'], 'created_at' => now()->format('Y-m-d H:i:s.u'),
    ]))->toThrow(QueryException::class);

    $ligne = $this->getJson(X::url($s['org'], "/cases/{$s['case']}"))->json('data.items.0.id');
    $this->deleteJson(X::url($s['org'], "/cases/{$s['case']}/items/{$ligne}"))->assertOk();
    expect($revendications()->count())->toBe(1);

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/items"), ['installment_ids' => [$s['ids'][0]]])->assertOk();
    expect($revendications()->count())->toBe(2);

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/status"), ['status' => 'closed'])->assertOk();
    expect($revendications()->count())->toBe(0);
});

it('refuse en 409 une créance déjà revendiquée même si le contrôle applicatif est contourné', function (): void {
    $s = X::dossier($this, 1);
    $autre = L::partie($s['org']);
    R::lier($s['org'], $s['bail'], $autre, ['valid_from' => '2026-01-01']);
    $second = X::ouvrir($this, $s['org'], $s['bail'], $autre, [$s['ids'][1]])->assertCreated()->json('data.id');

    DB::table('recovery_item_claims')->where('item_id', $s['ids'][0])->update(['case_id' => $second]);
    DB::table('recovery_item_claims')->where('item_id', $s['ids'][1])->delete();
    DB::table('recovery_item_claims')->insert(['organization_id' => $s['org']->id, 'item_type' => 'installment', 'item_id' => $s['ids'][1], 'case_id' => $s['case'], 'created_at' => now()->format('Y-m-d H:i:s.u')]);

    $this->postJson(X::url($s['org'], "/cases/{$second}/items"), ['installment_ids' => [$s['ids'][2]]])->assertOk();
    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/items"), ['installment_ids' => [$s['ids'][2]]])->assertConflict()->assertJsonPath('code', 'recovery_receivable_taken');
});

it('la migration des revendications rebâtit l\'existant et refuse un doublon actif', function (): void {
    $s = X::dossier($this, 2);
    $autre = L::partie($s['org']);
    R::lier($s['org'], $s['bail'], $autre, ['valid_from' => '2026-01-01']);
    X::ouvrir($this, $s['org'], $s['bail'], $autre, [$s['ids'][2]])->assertCreated();
    $migration = require app_path('Modules/Recovery/Database/Migrations/2026_11_17_110000_create_recovery_item_claims.php');

    Schema::drop('recovery_item_claims');
    $migration->up();
    expect(DB::table('recovery_item_claims')->count())->toBe(3);

    $second = L::dans($s['org'], fn () => RecoveryCaseItem::query()->where('item_id', $s['ids'][2])->firstOrFail()->case_id);
    L::dans($s['org'], fn () => RecoveryCaseItem::query()->create([
        ...RecoveryCaseItem::query()->where('item_id', $s['ids'][0])->firstOrFail()->only(['item_type', 'item_id', 'currency', 'period_start', 'period_end', 'due_date', 'total_amount', 'amount_due']),
        'case_id' => $second, 'included_at' => now(),
    ]));
    Schema::drop('recovery_item_claims');

    expect(fn () => $migration->up())->toThrow(RuntimeException::class, 'plusieurs dossiers actifs');
});

it('refuse un modèle de lien sans {token} ou hors https, sans rien écrire', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org']);

    foreach (['https://liens.example.test/transmission', 'http://liens.example.test/{token}'] as $modele) {
        config(['recovery.transmission.link_url' => $modele]);
        $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => $bailiff])->assertStatus(503)->assertJsonPath('code', 'recovery_link_unavailable');
    }

    Mail::assertNothingSent();
    expect(L::dans($s['org'], fn () => RecoveryTransmission::query()->count()))->toBe(0);
});

it('l\'envoi du lien a un backoff progressif et un échec journalisé sans jeton', function (): void {
    $listener = app(SendBundleLink::class);
    $delais = $listener->backoff();

    expect($delais)->not->toBeEmpty()->and($delais)->toBe(collect($delais)->sort()->values()->all())->and(count($delais))->toBe($listener->tries - 1);

    Log::spy();
    $jeton = Str::random(48);
    $listener->failed(new RecoveryBundleSent('org-1', 'tr-1', $jeton), new RuntimeException('smtp '.$jeton));

    Log::shouldHaveReceived('error')->once()->withArgs(fn (string $message, array $contexte): bool => ! str_contains(json_encode($contexte, JSON_THROW_ON_ERROR), $jeton) && $contexte['transmission_id'] === 'tr-1');
});

it('refuse une diligence antérieure à l\'ouverture ou future, et écrit acte et audit en une transaction', function (): void {
    $s = X::dossier($this, 1);
    $url = X::url($s['org'], "/cases/{$s['case']}/acts");

    $this->postJson($url, ['type' => 'call', 'performed_on' => '2026-11-15'])->assertUnprocessable()->assertJsonValidationErrors('performed_on');
    $this->postJson($url, ['type' => 'call', 'performed_on' => '2026-11-17'])->assertUnprocessable()->assertJsonValidationErrors('performed_on');
    expect(L::dans($s['org'], fn () => RecoveryAct::query()->count()))->toBe(0);

    $niveaux = [];
    DB::listen(function ($requete) use (&$niveaux): void {
        if (str_contains($requete->sql, 'insert into "recovery_acts"')) {
            $niveaux[] = DB::transactionLevel();
        }
    });
    $base = DB::transactionLevel();

    $this->postJson($url, ['type' => 'call', 'performed_on' => '2026-11-16'])->assertCreated();

    expect($niveaux)->toHaveCount(1)->and($niveaux[0])->toBeGreaterThan($base);
});

it('refuse une créance dont le porteur n\'est pas locataire du bail', function (): void {
    $s = X::impayes($this);
    $etranger = L::partie($s['org']);
    L::dans($s['org'], fn () => Installment::query()->whereKey($s['ids'][0])->update(['party_id' => $etranger->id]));

    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][1]])->assertCreated();
});
