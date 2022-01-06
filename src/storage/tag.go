package storage

import (
	"database/sql"
	"log"
	"strings"
)

type Tags struct {
	Names    map[int]string `json:"names"`
	FeedTags map[int][]int  `json:"feed_tags"`
	Parents  map[int]int    `json:"parents"`
}

func (s *Storage) ListTags() Tags {
	parents, err := s.db.Query(`
		select id, parent_id from tags where parent_id not NULL
	`)
	var res Tags
	res.Parents = make(map[int]int)
	for parents.Next() {
		var id int
		var parent int
		err = parents.Scan(&id, &parent)
		res.Parents[id] = parent
	}
	rows, err := s.db.Query(`
		select id, name from tags
	`)
	res.Names = make(map[int]string)
	for rows.Next() {
		var id int
		var name string
		err = rows.Scan(&id, &name)
		res.Names[id] = name
	}
	res.FeedTags = make(map[int][]int)
	rows, err = s.db.Query(`
		select feed_id, tag_id
		from feed_to_tag
	`)
	if err != nil {
		log.Println(err)
		return res
	}
	for rows.Next() {
		var feedId int
		var tagId int
		err = rows.Scan(&feedId, &tagId)
		if err != nil {
			log.Println(err)
			return res
		}
		res.FeedTags[feedId] = append(res.FeedTags[feedId], tagId)
	}
	return res
}

func (s *Storage) SetTags(feedId int, tags []string) bool {
	log.Println(tags)
	var args []interface{}
	args = append(args, feedId)
	for _, tag := range tags {
		args = append(args, tag)
	}
	extra := ""
	if len(tags) > 0 {
		extra = " and tag_id not in (select id from tags where name in (values (?)" + strings.Repeat(", (?)", len(tags)-1) + "))"
	}
	_, err := s.db.Exec("delete from feed_to_tag where feed_id=?"+extra, args...)
	if err != nil {
		log.Println(err)
		return false
	}
	stmt, err := s.db.Prepare("select id from tags where name=?")
	if err != nil {
		return false
	}
	for _, tag := range tags {
		log.Println(tag)
		res := stmt.QueryRow(tag)
		var tagId int64
		if err = res.Scan(&tagId); err != nil {
			insStmt, err := s.db.Prepare("insert into tags (name) values (?)")
			if err != nil {
				log.Println(err)
				return false
			}
			res, err := insStmt.Exec(tag)
			if err != nil {
				log.Println(err)
				return false
			}
			tagId, _ = res.LastInsertId()
		}
		_, err = s.db.Exec(`insert into feed_to_tag (feed_id, tag_id) values (?, ?) `, feedId, tagId)
		if err != nil {
			if !strings.HasPrefix(err.Error(), "UNIQUE constraint failed") {
				log.Println(err)
				return false
			}
		}
	}
	return true
}

func (s *Storage) SetParentTag(tagId, parentId int) bool {
	var pId sql.NullInt64
	if parentId != -1 {
		pId.Int64 = int64(parentId)
		pId.Valid = true
	}
	if _, err := s.db.Exec(`update tags set parent_id = ? where id = ?`, pId, tagId); err != nil {
		log.Println(err)
		return false
	}
	return true
}
