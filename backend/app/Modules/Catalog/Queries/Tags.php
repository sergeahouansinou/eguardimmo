<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Queries;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final class Tags
{
    /**
     * @return CursorPaginator<int, Tag>
     */
    public function list(int $parPage): CursorPaginator
    {
        return Tag::query()->orderBy('name')->orderBy('id')->cursorPaginate($parPage);
    }

    public function get(string $id): Tag
    {
        return (Str::isUuid($id) ? Tag::query()->find($id) : null) ?? throw ErrorCode::TagNotFound->problem();
    }
}
