<?php

declare(strict_types=1);

use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Enums\ItemType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recovery_item_claims', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('item_type', 16);
            $table->uuid('item_id');
            $table->uuid('case_id');
            $table->dateTime('created_at', 6);

            $table->primary(['organization_id', 'item_type', 'item_id']);
            $table->index(['organization_id', 'case_id']);
            $table->foreign(['organization_id', 'case_id'])->references(['organization_id', 'id'])->on('recovery_cases');
        });

        Checks::add('recovery_item_claims', 'item_type', Checks::enum('item_type', ItemType::class));

        $actives = DB::table('recovery_case_items as i')
            ->join('recovery_cases as c', fn ($j) => $j->on('c.id', '=', 'i.case_id')->on('c.organization_id', '=', 'i.organization_id'))
            ->whereNull('i.removed_at')
            ->whereIn('c.status', array_map(fn (CaseStatus $s): string => $s->value, CaseStatus::active()));

        $doublons = DB::query()->fromSub((clone $actives)->select('i.item_id')->groupBy('i.organization_id', 'i.item_type', 'i.item_id')->havingRaw('count(*) > 1'), 'doublons')->count();

        if ($doublons > 0) {
            throw new RuntimeException("{$doublons} créance(s) figurent dans plusieurs dossiers actifs : à régulariser avant d'appliquer cette migration.");
        }

        DB::table('recovery_item_claims')->insertUsing(
            ['organization_id', 'item_type', 'item_id', 'case_id', 'created_at'],
            $actives->select(['i.organization_id', 'i.item_type', 'i.item_id', 'i.case_id', 'i.included_at']),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('recovery_item_claims');
    }
};
