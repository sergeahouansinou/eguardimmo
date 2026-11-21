<?php

declare(strict_types=1);

use App\Modules\Messaging\Models\Conversation;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->equipe = L::membre($this->org, MemberRole::Manager);
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function ajouterFils(mixed $test, int $nombre, string $type): void
{
    for ($i = 0; $i < $nombre; $i++) {
        $fil = $type === 'tenant'
            ? M::filLocataire($test->org, $test->equipe, $test->locataire, "Sujet {$i}")
            : M::filMandant($test->org, $test->equipe, $test->mandant['party']->id, "Sujet {$i}");
        Conversation::query()->withoutGlobalScopes()->whereKey($fil->id)->update(['status' => 'closed']);
    }
}

function requetesDeLecture(callable $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $total = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $total;
}

it('lit la liste des fils avec un nombre de requêtes qui ne dépend pas du nombre de fils', function (string $type, Closure $lire): void {
    $mesures = [];
    $deja = 0;

    foreach ([1, 10, 100] as $cible) {
        ajouterFils($this, $cible - $deja, $type);
        $deja = $cible;
        $mesures[$cible] = requetesDeLecture(fn () => $lire($this)->assertOk()->assertJsonCount(min($cible, 100), 'data'));
    }

    expect($mesures[10])->toBe($mesures[1])->and($mesures[100])->toBe($mesures[1]);
})->with([
    'locataire' => ['tenant', fn (object $t) => T::comme($t, $t->locataire['user'])->getJson('/api/v1/tenant/conversations?per_page=100&archived=0')],
    'propriétaire' => ['owner', fn (object $t) => O::comme($t, $t->mandant['user'])->getJson('/api/v1/owner/conversations?per_page=100')],
    'équipe' => ['tenant', fn (object $t) => O::comme($t, $t->titulaire)->getJson("/api/v1/org/{$t->org->id}/conversations?kind=tenant&per_page=100")],
]);

it('lit l\'ouverture d\'un fil avec un nombre de requêtes constant quel que soit son historique', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->locataire);
    $mesures = [];
    $deja = 1;

    foreach ([1, 10, 50] as $cible) {
        for (; $deja < $cible; $deja++) {
            M::repondre($this->org, $this->equipe, $fil, "Message {$deja}");
        }

        $mesures[$cible] = requetesDeLecture(fn () => T::comme($this, $this->locataire['user'])->getJson("/api/v1/tenant/conversations/{$fil->id}")->assertOk());
    }

    expect($mesures[10])->toBe($mesures[1])->and($mesures[50])->toBe($mesures[1]);
});
