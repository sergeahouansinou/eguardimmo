<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\PublicApi\PartyDirectory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class Suppliers
{
    public function __construct(private PartyDirectory $parties) {}

    /**
     * @return CursorPaginator<int, SupplierProfile>
     */
    public function page(?SupplierStatus $statut, ?string $curseur, int $parPage): CursorPaginator
    {
        return SupplierProfile::query()->with('trades')
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): SupplierProfile
    {
        $profil = Str::isUuid($id) ? SupplierProfile::query()->with('trades')->whereKey($id)->first() : null;

        return $profil ?? throw ErrorCode::SupplierNotFound->problem();
    }

    /**
     * @param  iterable<SupplierProfile>  $profils
     * @return array<string, PartyData>
     */
    public function parties(iterable $profils): array
    {
        $ids = [];

        foreach ($profils as $profil) {
            $ids[] = $profil->party_id;
        }

        return $ids === [] ? [] : $this->parties->findMany($ids);
    }
}
